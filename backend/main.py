from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
import time
import asyncio
import string
import random

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PlayerState:
    def __init__(self, username, x=400, y=300):
        self.username = username
        self.x = x
        self.y = y
        self.keys = {"w": False, "a": False, "s": False, "d": False}
        self.is_moving = False
        self.facing_right = True
        self.is_chatting = False # New state
        self.last_update = time.time()

class Game:
    def __init__(self):
        self.players = {} # {user_id: PlayerState}
        
        # Physics loop task
        self.physics_task = None
        self.leader = None # Store user_id of the leader

    def cleanup(self):
        if self.physics_task and not self.physics_task.done():
            self.physics_task.cancel()
            print("Physics task cancelled.")

    def handle_input(self, user_id: str, key: str, is_down: bool):
        if user_id not in self.players:
            return 
        
        key = key.lower()
        if key in self.players[user_id].keys:
            self.players[user_id].keys[key] = is_down

    async def run_physics_loop(self, room_code: str):
        print(f"Starting physics loop for {room_code}")
        while True: 
            start_time = time.time()
            
            state_snapshot = {}
            for uid, p in self.players.items():
                speed = 400 # pixels per second (adjusted from 500)
                dt = 0.05 # 50ms tick
                
                dx = 0
                dy = 0
                if p.keys["w"]: dy -= speed * dt
                if p.keys["s"]: dy += speed * dt
                if p.keys["a"]: dx -= speed * dt
                if p.keys["d"]: dx += speed * dt
                
                p.x += dx
                p.y += dy
                
                # Update movement state
                p.is_moving = (dx != 0 or dy != 0)
                
                # Update facing direction (only if moving horizontally)
                if p.keys["a"] and not p.keys["d"]:
                    p.facing_right = False
                elif p.keys["d"] and not p.keys["a"]:
                    p.facing_right = True
                
                state_snapshot[uid] = {
                    "x": p.x, 
                    "y": p.y, 
                    "username": p.username,
                    "is_moving": p.is_moving,
                    "facing_right": p.facing_right,
                    "is_chatting": p.is_chatting,
                }
            
            if state_snapshot:
                await manager.broadcast_to_room(room_code, {
                    "type": "world_update",
                    "players": state_snapshot
                })
            
            await asyncio.sleep(0.05) # 20 ticks per second

    async def start_physics(self, room_code):
        if self.physics_task is None or self.physics_task.done():
             self.physics_task = asyncio.create_task(self.run_physics_loop(room_code))

# Global dictionary to store game instances keyed by room_code
games: Dict[str, Game] = {}

class ConnectionManager:
    def __init__(self):
        # Key: WebSocket, Value: dict (player info: user_id, username, room_code)
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        # Initial connection doesn't have metadata yet
        self.active_connections[websocket] = {"user_id": None, "username": None, "room_code": None}
        print(f"Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            data = self.active_connections[websocket]
            user_id = data.get("user_id")
            room_code = data.get("room_code")
            del self.active_connections[websocket]
            
            # Remove from game state
            if room_code and room_code in games:
                if user_id in games[room_code].players:
                    del games[room_code].players[user_id]
            
            print(f"Client {user_id} disconnected from room {room_code}. Total: {len(self.active_connections)}")
            return room_code, user_id
        return None, None

    async def send_personal_message(self, user_id: str, message: dict):
        for connection, data in self.active_connections.items():
            if data.get("user_id") == user_id:
                try:
                    await connection.send_json(message)
                except:
                    pass
                return

    async def broadcast_to_room(self, room_code: str, message: dict):
        if not room_code: return
        
        # Parallelize sends to reduce latency
        tasks = []
        # Iterate over a copy to avoid RuntimeError if connections close during iteration
        for connection, data in list(self.active_connections.items()):
            if data.get("room_code") == room_code:
                tasks.append(connection.send_json(message))
        
        if tasks:
            # Gather all send tasks; ignore individual failures (disconnects)
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_player_list(self, room_code: str):
        if not room_code: return

        players_list = []
        game_instance = games.get(room_code)
        
        # Check leader integrity
        if game_instance:
             # active_users is now list of user_ids
             active_ids = [data["user_id"] for _, data in self.active_connections.items() if data.get("room_code") == room_code and data.get("user_id")]
             
             if not game_instance.leader or game_instance.leader not in active_ids:
                 if active_ids:
                     game_instance.leader = active_ids[0] # First one or random
                     print(f"New leader for {room_code}: {game_instance.leader}")
                 else:
                     game_instance.leader = None

        current_leader = game_instance.leader if game_instance else None

        for _, data in list(self.active_connections.items()):
            if data.get("room_code") == room_code and data.get("user_id"):
                is_leader = (data["user_id"] == current_leader)
                players_list.append({
                    "id": data["user_id"],
                    "username": data["username"],
                    "is_leader": is_leader
                })
        
        await self.broadcast_to_room(room_code, {
            "type": "player_update",
            "players": players_list,
            "leader": current_leader
        })

manager = ConnectionManager()

@app.get("/")
async def get():
    all_games = {}
    for code, game in games.items():
        all_games[code] = {
            "players": {
                uid: {"x": p.x, "y": p.y, "username": p.username} 
                for uid, p in game.players.items()
            },
        }
    return {
        "message": "Coffee Chat Simulator Backend Running",
        "active_rooms": len(games),
        "total_connections": len(manager.active_connections),
        "games": all_games
    }

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length)) 

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "create_room":
                username = data.get("username")
                room_code = generate_room_code()
                
                # Ensure uniqueness
                while room_code in games:
                    room_code = generate_room_code()
                
                games[room_code] = Game()
                
                # Generate User ID for creator
                user_id = f"Guest{random.randint(100, 999)}"
                while user_id in games[room_code].players: 
                     user_id = f"Guest{random.randint(100, 999)}"

                games[room_code].leader = user_id # Creator is leader
                print(f"Created new room: {room_code} by {user_id} ({username})")
                
                manager.active_connections[websocket]["username"] = username 
                manager.active_connections[websocket]["user_id"] = user_id
                manager.active_connections[websocket]["room_code"] = room_code
                
                # Notify creator
                await websocket.send_json({
                    "type": "room_created",
                    "room_code": room_code
                })
                
                # Add to game state immediately
                games[room_code].players[user_id] = PlayerState(username)

                # START PHYSICS
                await games[room_code].start_physics(room_code)

                # Send welcome
                await websocket.send_json({
                    "type": "welcome",
                    "id": user_id,
                    "username": username,
                    "room_code": room_code
                })

                await manager.broadcast_player_list(room_code)

            elif message_type == "join":
                username = data.get("username")
                room_code = data.get("room_code", "").upper()
                
                if room_code not in games:
                    print(f"Room {room_code} not found, auto-creating...")
                    games[room_code] = Game()

                # Generate unique ID
                user_id = f"Guest{random.randint(100, 999)}"
                active_ids = [d["user_id"] for d in manager.active_connections.values() if d.get("room_code") == room_code]
                while user_id in active_ids:
                    user_id = f"Guest{random.randint(100, 999)}"

                manager.active_connections[websocket]["username"] = username 
                manager.active_connections[websocket]["user_id"] = user_id
                manager.active_connections[websocket]["room_code"] = room_code
                
                print(f"Player {username} -> {user_id} joined room {room_code}")

                # START PHYSICS (if not already running)
                await games[room_code].start_physics(room_code)

                # Send welcome
                await websocket.send_json({
                    "type": "welcome",
                    "id": user_id, 
                    "username": username, 
                    "room_code": room_code
                })
                
                # Add to game state immediately using ID
                if user_id not in games[room_code].players:
                    games[room_code].players[user_id] = PlayerState(username)

                await manager.broadcast_player_list(room_code)

            elif message_type == "video_update":
                user_id = manager.active_connections[websocket]["user_id"]
                username = manager.active_connections[websocket]["username"]
                room_code = manager.active_connections[websocket]["room_code"]
                frame_data = data.get("frame")
                
                if room_code:
                    # Broadcast with ID
                    await manager.broadcast_to_room(room_code, {
                        "type": "video_update",
                        "id": user_id,
                        "username": username,
                        "frame": frame_data
                    })

            elif message_type == "audio_update":
                user_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]
                chunk = data.get("chunk")
                to_id = data.get("to_id")
                
                if room_code:
                     if to_id:
                         # Private Unicast
                         await manager.send_personal_message(to_id, {
                            "type": "audio_update",
                            "id": user_id,
                            "chunk": chunk
                         })
                     else:
                         # Public Broadcast
                         await manager.broadcast_to_room(room_code, {
                            "type": "audio_update",
                            "id": user_id,
                            "chunk": chunk
                         })

            elif message_type == "coffee_invite":
                target_id = data.get("target_id")
                sender_id = manager.active_connections[websocket]["user_id"]
                sender_name = manager.active_connections[websocket]["username"]
                
                await manager.send_personal_message(target_id, {
                    "type": "coffee_invite",
                    "sender_id": sender_id,
                    "sender_name": sender_name
                })

            elif message_type == "coffee_accept":
                target_id = data.get("target_id") # The person who invited me
                sender_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]
                
                # Update state
                if room_code in games:
                    if sender_id in games[room_code].players:
                        games[room_code].players[sender_id].is_chatting = True
                    if target_id in games[room_code].players:
                        games[room_code].players[target_id].is_chatting = True
                
                # Notify both to start
                await manager.send_personal_message(target_id, {
                    "type": "coffee_start",
                    "partner_id": sender_id
                })
                await manager.send_personal_message(sender_id, {
                    "type": "coffee_start",
                    "partner_id": target_id
                })

            elif message_type == "coffee_leave":
                target_id = data.get("target_id") # The partner
                sender_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]

                # Update state
                if room_code in games:
                    if sender_id in games[room_code].players:
                        games[room_code].players[sender_id].is_chatting = False
                    if target_id in games[room_code].players:
                        games[room_code].players[target_id].is_chatting = False
                
                if target_id:
                     await manager.send_personal_message(target_id, {
                        "type": "coffee_ended",
                        "partner_id": sender_id
                    })

            elif message_type == "keydown":
                user_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]
                key = data.get("key")
                
                if room_code and room_code in games:
                    games[room_code].handle_input(user_id, key, is_down=True)

            elif message_type == "keyup":
                user_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]
                key = data.get("key")
                
                if room_code and room_code in games:
                    games[room_code].handle_input(user_id, key, is_down=False)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Notify others
        if 'room_code' in locals():
            await manager.broadcast_player_list(room_code)

    except WebSocketDisconnect:
        # We need the user_id before disconnecting to remove from game state
        room_code, user_id_removed = manager.disconnect(websocket)
        
        if room_code:
            # Sync game state
            if room_code in games and user_id_removed:
                 if user_id_removed in games[room_code].players:
                     del games[room_code].players[user_id_removed]
            
            await manager.broadcast_player_list(room_code)
            # Check if room is empty
            active_ids = [p["user_id"] for p in manager.active_connections.values() if p.get("room_code") == room_code]
            if not active_ids and room_code in games:
                print(f"Room {room_code} is empty. Deleting...")
                if hasattr(games[room_code], 'cleanup'):
                    games[room_code].cleanup()
                del games[room_code]
    except Exception as e:
        print(f"Error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
