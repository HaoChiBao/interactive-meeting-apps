"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { IntermissionCanvas } from "@/components/IntermissionCanvas";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { getMediaStream } from "@/lib/media";
import { socketClient } from "@/lib/socket";
import { VideoBroadcaster } from "@/components/VideoBroadcaster";


export default function LobbyPage() {
  const router = useRouter();
  const { code } = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const roomCode = useGameStore(s => s.roomCode);
  const others = useGameStore(s => s.others);

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


  const copyCode = () => {
    if (typeof code === "string")
      navigator.clipboard.writeText(code);
  };

  if (!roomCode) {
    return <div className="p-10 text-center">Loading Café...</div>;
  }

  return (
    <main className="min-h-screen flex flex-col p-4 md:p-8 bg-white text-zinc-900 overflow-hidden relative">
      <div className="fixed inset-0 z-0">
        <IntermissionCanvas localStream={localStream} />
      </div>

      {localStream && <VideoBroadcaster stream={localStream} />}

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
            {others.length + 1} People Here
          </Badge>
        </div>
      </header>

      {/* Footer Overlay - Simplified for info */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex justify-center py-6 pointer-events-none">
        <div className="pointer-events-auto bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-200 shadow-sm text-xs text-zinc-500 font-medium">
          Coffee Chat Simulator is Running
        </div>
      </footer>
    </main>
  );
}

