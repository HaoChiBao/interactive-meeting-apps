"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IntermissionCanvas } from "@/components/IntermissionCanvas";
import { Badge } from "@/components/ui/badge";
import { Copy, Play } from "lucide-react";
import { getMediaStream } from "@/lib/media";
import { socketClient } from "@/lib/socket";
import { VideoBroadcaster } from "@/components/VideoBroadcaster";
import { LeaderboardOverlay } from "@/components/LeaderboardOverlay";


export default function LobbyPage() {
  const router = useRouter();
  const { code } = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const roomCode = useGameStore(s => s.roomCode);
  const phase = useGameStore(s => s.phase);
  const me = useGameStore(s => s.me);
  const others = useGameStore(s => s.others);
  const gameSettings = useGameStore(s => s.gameSettings);
  const isReady = useGameStore(s => s.isReady);

  const votes = useGameStore(s => s.votes);
  const isChoosingSettings = useGameStore(s => s.isChoosingSettings);
  const chosenSettings = useGameStore(s => s.chosenSettings);
  const isStarting = useGameStore(s => s.isStarting);

  const [spinResult, setSpinResult] = useState<number | null>(null);

  // Sync phase
  useEffect(() => {
    if (phase === "ROUND") {
      router.push(`/room/${code}/round`);
    }
  }, [phase, code, router]);

  // Handle animation
  useEffect(() => {
    if (isChoosingSettings && chosenSettings) {
      // Play animation
      let interval: NodeJS.Timeout;
      let count = 0;
      const options = chosenSettings.all_votes;

      interval = setInterval(() => {
        const random = options[Math.floor(Math.random() * options.length)];
        setSpinResult(random);
        count++;
        if (count > 20) { // 2 seconds roughly
          clearInterval(interval);
          setSpinResult(chosenSettings.num_rounds);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isChoosingSettings, chosenSettings]);

  // Acquire media and connect socket
  useEffect(() => {
    let mounted = true;

    // Set room code
    if (typeof code === "string") {
      useGameStore.getState().setRoomCode(code);
    }

    // Init name if needed
    const state = useGameStore.getState();
    let myName = state.me?.name;
    if (!myName) {
      // Try local storage
      const stored = localStorage.getItem("interview-royale-name");
      if (stored) {
        myName = stored;
      } else {
        myName = "Guest" + Math.floor(Math.random() * 1000);
      }
      useGameStore.getState().setMe(myName);
    }

    // Connect & Join
    socketClient.connect();

    if (myName) {
      socketClient.join(myName);
    }

    getMediaStream(true, true).then(s => {
      if (mounted) setLocalStream(s);
    }).catch(e => console.error(e));

    return () => {
      mounted = false;
    };
  }, [code]);

  const updateSettings = (partial: { num_rounds?: number }) => {
    console.log("Button clicked. updateSettings:", partial);
    // Logic constraint: 1-5
    if (partial.num_rounds !== undefined) {
      if (partial.num_rounds < 1) partial.num_rounds = 1;
      if (partial.num_rounds > 5) partial.num_rounds = 5;
    }
    socketClient.send("update_settings", { settings: { ...gameSettings, ...partial } });
  };

  const handleStart = () => {
    socketClient.startGame();
  };

  const copyCode = () => {
    if (typeof code === "string")
      navigator.clipboard.writeText(code);
  };

  if (!roomCode) {
    return <div className="p-10 text-center">Loading Room...</div>;
  }

  // Calculate my vote
  const myVote = (me && votes && votes[me.name]) || 3;

  return (
    <main className="min-h-screen flex flex-col p-4 md:p-8 bg-white text-zinc-900 overflow-hidden relative">
      <div className="fixed inset-0 z-0">
          <IntermissionCanvas localStream={localStream} />
      </div>

      {localStream && <VideoBroadcaster stream={localStream} />}

      {/* Animation Overlay */}
      {isChoosingSettings && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-in fade-in duration-300">
          <h2 className="text-3xl font-bold mb-8 animate-pulse text-indigo-400"
            style={{ 
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                letterSpacing: "-.50px", lineHeight: "1.00"
            }}
          >Choosing Settings...</h2>
          <div className="bg-white text-black text-9xl font-black p-12 rounded-3xl shadow-2xl min-w-[300px] text-center">
            {spinResult}
          </div>
          <p className="mt-8 text-xl opacity-80">Randomly selected from player votes!</p>
        </div>
      )}

      {/* 3..2..1 START Countdown Overlay */}
      {isStarting && (
        <CountdownOverlay />
      )}

      {/* Header Overlay */}
      <header className="fixed top-0 left-0 right-0 z-10 flex justify-between items-center p-8 pointer-events-none">
        
        {/* Room Code Pill */}
        <div className="pointer-events-auto bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4"
          style={{ 
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              letterSpacing: "-.50px", lineHeight: "1.00"
          }}
        >
          <div>
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Room Code</div>
              <div className="flex items-center gap-2 text-zinc-800 hover:text-indigo-600 cursor-pointer transition-colors" onClick={copyCode}>
                <span className="font-mono text-xl font-black tracking-tight">{roomCode}</span>
                <Copy className="w-4 h-4" />
              </div>
          </div>
        </div>

        {/* Player Count Pill */}
        <div className="pointer-events-auto"
          style={{ 
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              letterSpacing: "-.50px", lineHeight: "1.00"
          }}
        >
           <Badge variant="outline" className="text-base px-4 py-2 bg-white/90 backdrop-blur-md border-zinc-200 text-zinc-700 shadow-sm"
          style={{ 
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              letterSpacing: "-.50px", lineHeight: "1.00"
          }}
           >
             {others.length + 1} Players
           </Badge>
        </div>
      </header>

      {/* Replaced PlayerGrid Section with nothing (Canvas is bg) */}
      
      {/* Footer Overlay */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex justify-center flex-col items-center gap-4 py-6 pointer-events-none">
        <div className="flex flex-col md:flex-row gap-6 items-end w-full max-w-4xl px-4 pointer-events-auto">
           
           {/* Game Settings Card - Floating */}
            <div className="bg-white/90 border border-zinc-200/50 p-6 rounded-2xl flex-1 w-full shadow-xl backdrop-blur-md">
                <h3 className="font-bold text-xs uppercase text-zinc-400 mb-3 tracking-wider"
                style={{ 
                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                    letterSpacing: "-.50px", lineHeight: "1.00"
                }}
                >Game Settings</h3>
                <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-700"
                    style={{ 
                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        letterSpacing: "-.50px", lineHeight: "1.00"
                    }}
                    >Number of Rounds</span>
                    <div className="flex items-center gap-3">
                        {me?.isLeader ? (
                             <>
                                <Button 
                                variant="outline" size="icon" className="h-8 w-8 rounded-full border-zinc-300"
                                onClick={() => updateSettings({ num_rounds: gameSettings.num_rounds - 1 })}
                                disabled={isChoosingSettings || useGameStore.getState().isStarting}
                                > - </Button>
                                <span className="w-8 text-center font-bold text-xl text-zinc-800"
                                style={{ 
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-.50px", lineHeight: "1.00"
                                }}
                                >{gameSettings.num_rounds}</span>
                                <Button 
                                variant="outline" size="icon" className="h-8 w-8 rounded-full border-zinc-300"
                                onClick={() => updateSettings({ num_rounds: gameSettings.num_rounds + 1 })}
                                disabled={isChoosingSettings || useGameStore.getState().isStarting}
                                > + </Button>
                             </>
                        ) : (
                             <span className="w-8 text-center font-bold text-xl text-zinc-400"
                             style={{ 
                                 fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                 letterSpacing: "-.50px", lineHeight: "1.00"
                             }}
                             >{gameSettings.num_rounds}</span>
                        )}
                    </div>    
                </div>
                {!me?.isLeader && (
                    <p className="text-[10px] text-zinc-400 mt-2 text-center uppercase tracking-wide">
                        Host Controls Only
                    </p>
                )}
            </div>

            {/* Start Button Area */}
            <div className="flex-1 w-full flex flex-col items-center justify-center gap-4">
                 {me?.isLeader ? (
                     <Button 
                        size="lg" 
                        className="w-full font-bold text-lg h-16 shadow-xl shadow-indigo-500/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-indigo-500/50"
                        style={{ 
                            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                            letterSpacing: "-.50px", lineHeight: "1.00"
                        }}
                        onClick={handleStart}
                        disabled={isChoosingSettings || useGameStore.getState().isStarting} 
                    >
                        <Play className="w-6 h-6 mr-2 fill-current" />
                        {useGameStore.getState().isStarting ? "Starting..." : "Start Game"}
                    </Button>
                 ) : (
                     <div className="text-center p-4 bg-white/80 backdrop-blur rounded-xl text-zinc-500 font-medium border border-white/40 shadow-lg w-full"
                     style={{ 
                         fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                         letterSpacing: "-.50px", lineHeight: "1.00"
                     }}
                     >
                        Waiting for leader...
                     </div>
                 )}
            </div>
            {!me?.isLeader && (
              <p className="text-xs text-zinc-400 mt-4 text-center"
              style={{ 
                  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                  letterSpacing: "-.50px", lineHeight: "1.00"
              }}
              >
                Only the leader can change settings.
              </p>  
            )}
          </div>


      </footer>
    </main>
  );
}

function CountdownOverlay() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => prev > 1 ? prev - 1 : 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center text-white backdrop-blur-md animate-in fade-in duration-300">
      <div className="text-[200px] font-black animate-pulse leading-none bg-gradient-to-b from-indigo-400 to-purple-600 bg-clip-text text-transparent"
        style={{ 
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          letterSpacing: "-.50px", lineHeight: "1.00"
      }}
      >
        {count}
      </div>
      <h2 className="text-3xl font-bold mt-8 text-zinc-300 animate-bounce"
      style={{ 
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          letterSpacing: "-.50px", lineHeight: "1.00"
      }}
      >
        Prepare for the interview...
      </h2>
    </div>
  );
}
