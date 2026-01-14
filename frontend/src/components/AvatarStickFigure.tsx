import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AvatarStickFigureProps {
  name: string;
  isMe: boolean;
  stream?: MediaStream | null; // Only for 'me'
  cameraEnabled?: boolean;
  className?: string;
  seed?: string; // For bot randomization if needed
  lastVideoFrame?: string;
  isLeader?: boolean;
  isMoving?: boolean;
  facingRight?: boolean;
  volume?: number; // 0 to 1
  onClick?: () => void;
  isChatting?: boolean;
  hideNameTag?: boolean;
}

import idleImage from "@/assets/idle.png";
import walkingImage from "@/assets/walking.gif";

export function AvatarStickFigure({
  name,
  isMe,
  stream,
  cameraEnabled,
  className,
  lastVideoFrame,
  isLeader,
  isMoving,
  facingRight = true, // Default to true if undefined
  volume = 0,
  onClick,
  isChatting,
  hideNameTag,
}: AvatarStickFigureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center group",
        onClick && "cursor-pointer hover:scale-105 active:scale-95 transition-transform",
        className
      )}
    >
      {/* Chat in Progress Bubble */}
      {isChatting && (
        <div className="absolute -top-8 z-30 bg-white border-2 border-slate-300 rounded-2xl px-3 py-1.5 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <div className="flex gap-1 items-center justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider whitespace-nowrap">On Call</span>
            <span className="flex gap-0.5">
              <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce"></span>
            </span>
          </div>
        </div>
      )}

      {/* Crown for Leader */}
      {isLeader && (
        <div className="absolute -top-12 text-3xl animate-bounce z-20">👑</div>
      )}

      {/* Main Character Container - Reduced by 30% (was 320px -> 224px) */}
      <div className="relative w-[224px] h-[224px]">
        {/* Character Images - Pre-rendered and toggled via opacity to prevent flickering */}

        {/* Walking GIF */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={walkingImage.src}
          alt="Walking"
          className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
          style={{
            opacity: isMoving ? 1 : 0,
            transform: `
                    translateY(12%)
                    scale(0.5) 
                    scaleX(${!facingRight ? -1 : 1})
                `
          }}
        />

        {/* Idle PNG */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={idleImage.src}
          alt="Idle"
          className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
          style={{
            opacity: isMoving ? 0 : 1,
            transform: `
                    translateY(5%)
                    scale(1) 
                    scaleX(${!facingRight ? -1 : 1})
                `
          }}
        />

        {/* Face Overlay - 98px */}
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[98px] h-[98px] z-10">
          {isMe && cameraEnabled && stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "w-full h-full rounded-full object-cover border-4 transition-all duration-75",
                volume > 0.05 ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]" : "border-black"
              )}
              style={{
                transform: `scaleX(-1) scale(${1 + volume * 0.1})`
              }}
            />
          ) : !isMe && lastVideoFrame ? (
            <img
              src={lastVideoFrame}
              alt={name}
              className={cn(
                "w-full h-full rounded-full object-cover border-4 transition-all duration-75",
                volume > 0.05 ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]" : "border-black"
              )}
              style={{
                transform: `scale(${1 + volume * 0.1})`
              }}
            />
          ) : (
            <div
              className={cn(
                "w-full h-full rounded-full border-4 bg-slate-300 flex items-center justify-center overflow-hidden transition-all duration-75",
                volume > 0.05 ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]" : "border-black"
              )}
              style={{
                transform: `scale(${1 + volume * 0.1})`
              }}
            >
              <span className="text-4xl font-bold uppercase text-black">
                {name.slice(0, 2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Name Label */}
      {!hideNameTag && (
        <div className="mt-1 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full flex gap-1 items-center z-20 whitespace-nowrap"
        style={{ 
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            letterSpacing: "-0.5px"
        }}>
          {name} {isMe ? "(You)" : ""}
        </div>
      )}

      {/* Volume Indicator (Green Ring) */}

    </div>
  );
}
