import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AvatarStickFigureProps {
  name: string;
  isMe: boolean;
  stream?: MediaStream | null;
  cameraEnabled?: boolean;
  className?: string;
  lastVideoFrame?: string;
  volume?: number;
  onClick?: () => void;
  hideNameTag?: boolean;
}

export function AvatarStickFigure({
  name,
  isMe,
  stream,
  cameraEnabled,
  className,
  lastVideoFrame,
  volume = 0,
  onClick,
  hideNameTag,
}: AvatarStickFigureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const size = 98;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center",
        onClick && "cursor-pointer hover:scale-105 active:scale-95 transition-transform",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* Video Circle */}
      <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-black box-border shadow-sm z-10"
        style={{
          borderColor: volume > 0.05 ? "#22c55e" : "black",
          boxShadow: volume > 0.05 ? "0 0 15px rgba(34,197,94,0.6)" : "none",
          transition: "border-color 0.1s, box-shadow 0.1s"
        }}
      >
        {isMe && cameraEnabled && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        ) : !isMe && lastVideoFrame ? (
          <img
            src={lastVideoFrame}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-300 flex items-center justify-center">
            <span className="text-2xl font-bold uppercase text-black">
              {name.slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {/* Name Label */}
      {!hideNameTag && (
        <div className="absolute -bottom-6 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap z-20 font-sans">
          {name} {isMe ? "(You)" : ""}
        </div>
      )}
    </div>
  );
}

