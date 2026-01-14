import asyncio
import websockets
import json

URI = "ws://localhost:8000/ws"

async def run_host():
    """Simulates a Host who creates a room and starts the game."""
    async with websockets.connect(URI) as websocket:
        print("[HOST] Connecting...")
        
        # 1. Create Room
        await websocket.send(json.dumps({
            "type": "create_room", 
            "username": "HOST_USER"
        }))
        
        # Wait for Room Code
        room_code = None
        while True:
            response = await websocket.recv()
            data = json.loads(response)
            if data.get("type") == "room_created":
                room_code = data["room_code"]
                print(f"[HOST] Room Created: {room_code}")
                break
        
        # Determine when player joins (wait for update with 2 players)
        while True:
            response = await websocket.recv()
            data = json.loads(response)
            print(f"[HOST] Received: {data}")
            if data.get("type") == "player_update" and len(data["players"]) >= 2:
                print("[HOST] 2 Players detected! Starting Game...")
                break

        # 2. Start Game
        await websocket.send(json.dumps({"type": "start_game"}))
        print("[HOST] Sent START_GAME")

        await play_round(websocket, "HOST_USER")

async def run_joiner(room_code):
    """Simulates a player joining an existing room."""
    # Give host a second to set up
    await asyncio.sleep(1)
    
    async with websockets.connect(URI) as websocket:
        print(f"[JOINER] Connecting to room {room_code}...")
        
        await websocket.send(json.dumps({
            "type": "join",
            "username": "JOINER_USER",
            "room_code": room_code
        }))
        
        await play_round(websocket, "JOINER_USER")

async def play_round(websocket, name):
    """Common game logic for playing a round."""
    while True:
        response = await websocket.recv()
        data = json.loads(response)
        
        if data.get("type") == "new_question":
            print(f"[{name}] Question received: {data['question']['prompt']}")
            
            # Simulate thinking time
            await asyncio.sleep(0.5)
            
            submission = {
                "type": "submit",
                "content": f"Answer from {name}: I used the STAR method perfectly."
            }
            await websocket.send(json.dumps(submission))
            print(f"[{name}] Submitted answer.")
            
        elif data.get("type") == "round_over":
            print(f"[{name}] Round Over! Results: {data['results']}")
            break

async def main():
    # 1. Start Host to create room
    # We need to run Host and capture the room code to give to Joiner.
    # To keep it simple in one script, we'll start Host, wait for the code, then spawn Joiner.
    # But `run_host` blocks. 
    # Alternative: Have Host write code to a global or queue? 
    # Better: Start Host, have it print code, and we manually run joiner?
    # Automated approach: Run both as Tasks, communicate code via Queue.
    
    queue = asyncio.Queue()

    # Modified Host to put code in queue
    async def host_wrapper():
        async with websockets.connect(URI) as websocket:
            print("[HOST] Creating Room...")
            await websocket.send(json.dumps({"type": "create_room", "username": "HOST"}))
            
            response = await websocket.recv() # room_created
            data = json.loads(response)
            room_code = data["room_code"]
            print(f"[HOST] Room: {room_code}")
            await queue.put(room_code)
            
            # Read own join update
            await websocket.recv() 

            # Wait for joiner
            while True:
                msg = await websocket.recv()
                d = json.loads(msg)
                if d.get("type") == "player_update" and len(d["players"]) == 2:
                    break
            
            print("[HOST] Starting Game")
            await websocket.send(json.dumps({"type": "start_game"}))
            await play_round(websocket, "HOST")

    host_task = asyncio.create_task(host_wrapper())
    
    # Wait for room code
    code = await queue.get()
    
    joiner_task = asyncio.create_task(run_joiner(code))
    
    await asyncio.gather(host_task, joiner_task)

if __name__ == "__main__":
    asyncio.run(main())
