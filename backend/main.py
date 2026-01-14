from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
from questions import get_random_question
from grading import grade_submission

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

import time

class PlayerState:
    def __init__(self, username, x=400, y=300):
        self.username = username
        self.x = x
        self.y = y
        self.keys = {"w": False, "a": False, "s": False, "d": False}
        self.is_moving = False
        self.facing_right = True
        self.is_chatting = False # New state
        self.has_submitted = False # Track submission status
        self.last_update = time.time()

class Game:
    def __init__(self):
        self.state = "LOBBY"
        self.current_question = None
        self.submissions = {} # {user_id: {submission: ..., score: ...}}
        self.players = {} # {user_id: PlayerState}
        
        # New Settings
        self.settings = {
            "num_rounds": 3,
            "round_duration": 60
        }
        self.votes = {} # {user_id: num_rounds}
        self.current_round = 0
        self.cumulative_scores = {} # {user_id: int}
        
        # Physics loop task
        self.physics_task = None
        self.round_end_time = None
        self.leader = None # Store user_id of the leader
    def cleanup(self):
        if self.physics_task and not self.physics_task.done():
            self.physics_task.cancel()
            print("Physics task cancelled.")

    def handle_input(self, user_id: str, key: str, is_down: bool):
        if user_id not in self.players:
            return # Should exist
        
        key = key.lower()
        if key in self.players[user_id].keys:
            self.players[user_id].keys[key] = is_down

    async def run_physics_loop(self, room_code: str):
        print(f"Starting physics loop for {room_code}")
        while self.state in ["LOBBY", "INTERMISSION", "QUESTION"]: # Allow physics during lobby and question for early finishers
            # Ideally always if we want movement in lobby too, but let's stick to Intermission request.
            # Actually, user said "Intermission Room", but let's make it robust.
            # If we constrain to Intermission, we need to start/stop this task.
            # For simplicity, let's just check state inside loop and sleep if not active.
            
            start_time = time.time()
            
            state_snapshot = {}
            for uid, p in self.players.items():
                speed = 300 # pixels per second
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
                
                # Infinite boundaries
                # p.x = max(0, min(800, p.x))
                # p.y = max(0, min(600, p.y))
                
                state_snapshot[uid] = {
                    "x": p.x, 
                    "y": p.y, 
                    "username": p.username,
                    "is_moving": p.is_moving,
                    "username": p.username,
                    "is_moving": p.is_moving,
                    "facing_right": p.facing_right,
                    "facing_right": p.facing_right,
                    "is_chatting": p.is_chatting,
                    "has_submitted": p.has_submitted
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


    def update_settings(self, settings: dict):
        self.settings.update(settings)

    def cast_vote(self, user_id: str, num_rounds: int):
        self.votes[user_id] = num_rounds
        # Update settings to reflect a "preview" or average? 
        # For now, we don't update self.settings until game start, 
        # but we might want to show the current "consensus" or just last vote?
        # Let's keep self.settings as the "live" value for now so the UI updates
        # But conceptually, we will pick from self.votes at start.
        self.settings["num_rounds"] = num_rounds 
    
    async def _ensure_physics(self, room_code):
        if self.physics_task is None or self.physics_task.done():
             self.physics_task = asyncio.create_task(self.run_physics_loop(room_code))

    async def start_round(self, room_code): # Needs room_code to start physics
        self.state = "QUESTION"
        self.current_round += 1
        self.current_question = get_random_question()
        self.current_question = get_random_question()
        self.submissions = {}
        # Reset submission status for all players
        for p in self.players.values():
            p.has_submitted = False
            
        self.round_end_time = time.time() + self.settings["round_duration"]
        
        # Ensure physics loop is running for this round
        await self._ensure_physics(room_code)
        
        return self.current_question

    async def handle_intermission(self, room_code: str):
        if room_code not in games: return
        game = games[room_code]
        
        # Start physics for intermission
        game.state = "INTERMISSION" # Strictly set this state
        await game.start_physics(room_code)
        
        # Wait for intermission
        await asyncio.sleep(60) # 1 minute intermission

        # RACE CONDITION FIX: check if state changed manually (e.g. via Next Round button)
        if game.state != "INTERMISSION":
            print(f"Intermission aborted for {room_code}, state is already {game.state}")
            return
        
        # Check if game over
        if game.current_round >= game.settings["num_rounds"]:
            game.state = "GAME_OVER"
            leaderboard = game.get_leaderboard()
            await manager.broadcast_to_room(room_code, {
                "type": "game_over",
                "leaderboard": leaderboard
            })
            return

        # Start next round
        question = await game.start_round(room_code)
        
        # Start monitoring
        asyncio.create_task(game.monitor_round(room_code, game.current_round))
        
        await manager.broadcast_to_room(room_code, {
            "type": "new_question",
            "question": question,
            "state": "QUESTION",
            "current_round": game.current_round,
            "total_rounds": game.settings["num_rounds"]
        })

    async def monitor_round(self, room_code: str, round_num: int):
        duration = self.settings["round_duration"]
        await asyncio.sleep(duration)
        
            # Check if we are still in the same round and state is QUESTION
        if self.state == "QUESTION" and self.current_round == round_num:
            print(f"Round {round_num} time expired. Batch grading...")
            
            await self.perform_batch_grading()
            results = self.end_round()
            leaderboard = self.get_leaderboard()
            
            # Broadcast round over
            await manager.broadcast_to_room(room_code, {
                "type": "round_over",
                "results": results,
                "leaderboard": leaderboard,
                "state": "RESULTS",
                "is_final_round": self.current_round >= self.settings["num_rounds"],
                "intermission_end_time": time.time() + 60
            })
            
            # Start intermission
            asyncio.create_task(self.handle_intermission(room_code))

    async def perform_batch_grading(self):
        print("Starting batch grading...")
        tasks = []
        user_ids_to_grade = []

        for uid, data in self.submissions.items():
            # If no score yet, grade it
            if data.get("score") is None:
                content = data.get("content", "")
                tasks.append(grade_submission(content, self.current_question))
                user_ids_to_grade.append(uid)
        
        if tasks:
            results = await asyncio.gather(*tasks)
            
            for uid, result in zip(user_ids_to_grade, results):
                self.submissions[uid]["score"] = result["score"]
                self.submissions[uid]["feedback"] = result["feedback"]
                print(f"Graded {uid}: {result['score']}")
        
        print("Batch grading complete.")

    def end_round(self):
        self.state = "RESULTS"
        if not self.submissions:
            return []
            
        # Update cumulative scores
        for uid, data in self.submissions.items():
            score = data.get("score", 0)
            self.cumulative_scores[uid] = self.cumulative_scores.get(uid, 0) + score
            
        # Return round results sorted by score
        # Need to include usernames? Or let frontend map it? 
        # Ideally backend sends username too. We need to lookup username from players.
        results = []
        for uid, v in self.submissions.items():
            if v.get("score") is not None:
                p_state = self.players.get(uid)
                u_name = p_state.username if p_state else "Unknown"
                results.append({"user_id": uid, "username": u_name, **v})

        sorted_results = sorted(
            results,
            key=lambda x: x["score"],
            reverse=True
        )
        return sorted_results
        
    def get_leaderboard(self):
        # Return cumulative leaderboard
        lb = []
        for uid, score in self.cumulative_scores.items():
             p_state = self.players.get(uid)
             u_name = p_state.username if p_state else "Unknown"
             lb.append({"user_id": uid, "username": u_name, "score": score})

        return sorted(
            lb,
            key=lambda x: x["score"],
            reverse=True
        )

# Global dictionary to store game instances keyed by room_code
# { "ABCD": Game() }
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
        
        current_state = game_instance.state if game_instance else "LOBBY"

        await self.broadcast_to_room(room_code, {
            "type": "player_update",
            "players": players_list,
            "game_state": current_state,
            "leader": current_leader
        })

manager = ConnectionManager()

@app.get("/")
async def get():
    all_games = {}
    for code, game in games.items():
        all_games[code] = {
            "state": game.state,
            "settings": game.settings,
            "current_round": game.current_round,
            "leader": getattr(game, 'leader', None),
            "players": {
                uid: {"x": p.x, "y": p.y, "keys": p.keys, "username": p.username} 
                for uid, p in game.players.items()
            },
            "submissions_count": len(game.submissions),
            "cumulative_scores": game.cumulative_scores,
            "votes": game.votes
        }
    return {
        "message": "Interview Royale Backend Running",
        "active_rooms": len(games),
        "total_connections": len(manager.active_connections),
        "games": all_games
    }

import string
import random
import asyncio

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length)) 

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            # print(f"Received: {data}")

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

                # Initialize creator's vote to default
                games[room_code].votes[user_id] = 3
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
                # ... existing join logic ...
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

                # Send current settings to the new joiner
                game = games[room_code]

                # Default vote for new player?
                if user_id not in game.votes:
                     game.votes[user_id] = 3
                     
                await websocket.send_json({
                    "type": "settings_update",
                    "settings": game.settings,
                    "votes": game.votes
                })
                
                await manager.broadcast_player_list(room_code)
                
                # If game is in progress, sync state
                if game.state != "LOBBY":
                    # Determine current phase details
                    # Note: We need to send relevant info depending on phase
                    await websocket.send_json({
                        "type": "sync_game_state",
                        "phase": game.state, # QUESTION, RESULTS, INTERMISSION
                        "question": game.current_question,
                        "current_round": game.current_round,
                        "total_rounds": game.settings["num_rounds"],
                        "round_end_time": game.round_end_time
                    })

            elif message_type == "update_settings":
                room_code = manager.active_connections[websocket]["room_code"]
                user_id = manager.active_connections[websocket]["user_id"]
                if not room_code or room_code not in games: continue
                
                game = games[room_code]
                print(f"Update settings: {user_id} in {room_code}. State: {game.state}")
                if game.state == "LOBBY":
                    new_settings = data.get("settings", {})
                    # Cast vote
                    rounds = new_settings.get("num_rounds", 3)
                    print(f"Casting vote: {rounds}")
                    rounds = new_settings.get("num_rounds")
                    
                    if rounds is not None:
                         # Clamp 1-10
                         rounds = max(1, min(10, int(rounds)))
                         game.settings["num_rounds"] = rounds
                    
                    # Broadcast updated settings
                    await manager.broadcast_to_room(room_code, {
                        "type": "settings_update",
                        "settings": game.settings
                    })

            elif message_type == "start_game":
                # Only leader can start
                user_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                game = games[room_code]

                if game.leader and game.leader != user_id:
                    print(f"User {user_id} tried to start game but is not leader ({game.leader})")
                    continue
                
                # Broadcast STARTING event for countdown on frontend
                await manager.broadcast_to_room(room_code, {
                    "type": "game_starting"
                })
                
                # 3 second countdown logic on server (wait before sending new question)
                await asyncio.sleep(3) 

                # Reset game state
                if game.state == "LOBBY" or game.state == "GAME_OVER":
                     game.current_round = 0
                     game.cumulative_scores = {}
                
                question = await game.start_round(room_code)
                
                # Start round monitoring
                asyncio.create_task(game.monitor_round(room_code, game.current_round))
                
                await manager.broadcast_to_room(room_code, {
                    "type": "new_question",
                    "question": question,
                    "state": "QUESTION",
                    "current_round": game.current_round,
                    "total_rounds": game.settings["num_rounds"]
                })

            elif message_type == "skip_intermission":
                user_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                game = games[room_code]

                if game.leader and game.leader != user_id:
                    print(f"User {user_id} tried to skip intermission but is not leader")
                    continue
                
                if game.state == "INTERMISSION":
                    if game.current_round >= game.settings["num_rounds"]:
                         game.state = "GAME_OVER"
                         await manager.broadcast_to_room(room_code, {
                            "type": "game_over",
                            "leaderboard": game.get_leaderboard()
                         })
                    else:
                        question = await game.start_round(room_code) # This changes state to QUESTION
                        
                        # Start round monitoring
                        asyncio.create_task(game.monitor_round(room_code, game.current_round))

                        await manager.broadcast_to_room(room_code, {
                            "type": "new_question",
                            "question": question,
                            "state": "QUESTION",
                            "current_round": game.current_round,
                            "total_rounds": game.settings["num_rounds"]
                        })

            elif message_type == "next_round":
                user_id = manager.active_connections[websocket]["user_id"]
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                game = games[room_code]
                
                if game.leader and game.leader != user_id:
                     continue
                     
                if game.current_round >= game.settings["num_rounds"]:
                     game.state = "GAME_OVER"
                     await manager.broadcast_to_room(room_code, {
                        "type": "game_over",
                        "leaderboard": game.get_leaderboard()
                     })
                else:
                    question = await game.start_round(room_code)
                    
                    # Start round monitoring
                    asyncio.create_task(game.monitor_round(room_code, game.current_round))

                    await manager.broadcast_to_room(room_code, {
                        "type": "new_question",
                        "question": question,
                        "state": "QUESTION",
                        "current_round": game.current_round,
                        "total_rounds": game.settings["num_rounds"]
                    })

            elif message_type == "submit":
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                
                game = games[room_code]
                user_id = manager.active_connections[websocket]["user_id"]
                submission_content = data.get("content")
                
                # Store submission WITHOUT grading
                game.submissions[user_id] = {
                    "content": submission_content,
                    "score": None,     # Will be populated by batch grading
                    "feedback": []
                }
                
                # Notify user receipt (optional, or just wait for round_over)
                # await websocket.send_json({ "type": "submission_received" })
                
                # Update player state
                if user_id in game.players:
                    game.players[user_id].has_submitted = True
                
                # Check for round end
                room_players_count = len([
                    p for p in manager.active_connections.values() 
                    if p.get("room_code") == room_code and p.get("user_id")
                ])
                
                if len(game.submissions) >= room_players_count:
                    print("All players submitted. Triggering batch grading...")
                    # Trigger batch grading now
                    await game.perform_batch_grading()
                    
                    results = game.end_round()
                    leaderboard = game.get_leaderboard()
                    
                    # Schedule automatic next round (Intermission)
                    asyncio.create_task(game.handle_intermission(room_code))

                    await manager.broadcast_to_room(room_code, {
                        "type": "round_over",
                        "results": results,
                        "leaderboard": leaderboard,
                        "state": "RESULTS",
                        "is_final_round": game.current_round >= game.settings["num_rounds"],
                        "intermission_end_time": time.time() + 120
                    })

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
