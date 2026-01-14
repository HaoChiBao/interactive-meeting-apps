"use client";

import React, { useEffect } from "react";
import { AvatarStickFigure } from "./AvatarStickFigure";
import { useGameStore } from "@/store/useGameStore";
import { getMediaStream } from "@/lib/media"; // Only if we want to grab stream inside here? Better passed down or grabbed in page.

interface PlayerGridProps {
  localStream: MediaStream | null;
  variant?: "grid" | "row" | "running-row";
  excludeMe?: boolean;
}

export function PlayerGrid({ localStream, variant = "grid", excludeMe = false }: PlayerGridProps) {
  const me = useGameStore((state) => state.me);
  const others = useGameStore((state) => state.others);

  // Combine all players
  let allPlayers = me ? [me, ...others] : others;
  
  if (excludeMe && me) {
      allPlayers = allPlayers.filter(p => p.id !== me.id);
  }

  // --- Variant: Running Row (Animated) ---
  if (variant === "running-row") {
      return (
          <div className="relative w-full h-full min-h-[180px] flex items-end pointer-events-none">
              {allPlayers.map((player) => (
                  <RunningAvatar key={player.id} player={player} />
              ))}
          </div>
      );
  }

  // --- Variant: Grid or Standard Row ---
  return (
    <div className={
        variant === "grid" 
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 p-4 w-full max-w-6xl mx-auto"
        : "flex flex-row gap-8 overflow-x-auto p-4 justify-center items-end min-h-[160px]"
    }>
      {allPlayers.map((player, i) => (
        <div key={player.id || i} className="flex justify-center flex-shrink-0">
          <AvatarStickFigure
            name={player.name}
            isMe={player.isMe}
            stream={player.isMe ? localStream : undefined}
            cameraEnabled={player.cameraEnabled}
            lastVideoFrame={player.lastVideoFrame}
            isLeader={player.isLeader}
          />
        </div>
      ))}
    </div>
  );
}

// --- Helper Component for Running Animation ---
function RunningAvatar({ player }: { player: any }) {
    const [offset, setOffset] = React.useState(0);
    const [direction, setDirection] = React.useState<1 | -1>(1); // 1 = Right, -1 = Left
    const containerWidthPercent = 60 + Math.random() * 40; // 60% to 100% of viewport
    const [speed] = React.useState(2 + Math.random() * 3); // Random speed (pixels per tick? or just duration)
    
    // Actually, simple CSS animation is cleaner, but random behavior requires JS ref.
    // Let's use a simple requestAnimationFrame loop for smooth random movement.
    const posRef = React.useRef(Math.random() * 100); // Start at random %
    const dirRef = React.useRef(Math.random() > 0.5 ? 1 : -1);
    const speedRef = React.useRef(0.1 + Math.random() * 0.15); // Speed in % per frame
    
    // Limits (in %)
    const minPos = 0; 
    const maxPos = 90; // Don't go fully off screen right

    useEffect(() => {
        let frame: number;
        const loop = () => {
             // Move
             posRef.current += speedRef.current * dirRef.current;
             
             // Bounce
             if (posRef.current >= maxPos) {
                 posRef.current = maxPos;
                 dirRef.current = -1;
             } else if (posRef.current <= minPos) {
                 posRef.current = minPos;
                 dirRef.current = 1;
             }
             
             setOffset(posRef.current);
             setDirection(dirRef.current as 1 | -1);
             frame = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(frame);
    }, []);

    return (
        <div 
            className="absolute bottom-4 transition-transform will-change-transform"
            style={{ 
                left: `${offset}%`,
                // Make them varied in Z-index so they cross each other
                zIndex: Math.floor(offset) 
            }}
        >
            <AvatarStickFigure
                name={player.name}
                isMe={false}
                cameraEnabled={player.cameraEnabled}
                lastVideoFrame={player.lastVideoFrame}
                isLeader={player.isLeader}
                // Force Walking Animation
                isMoving={true} 
                facingRight={direction === 1}
            />
        </div>
    );
}
