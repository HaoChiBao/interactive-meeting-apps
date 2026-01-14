import React, { useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface CoffeeChatModalProps {
    partnerName: string;
    partnerFrame?: string; // Base64
    localStream?: MediaStream | null;
    onLeave: () => void;
}

export function CoffeeChatModal({ partnerName, partnerFrame, localStream, onLeave }: CoffeeChatModalProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm animate-in fade-in duration-300"
        style={{ 
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            letterSpacing: "-0.5px"
        }}>
            {/* Header */}
            <div className="absolute top-6 left-8 text-white">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    ☕ Coffee Chat
                    <span className="text-sm font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded">Private & Encrypted</span>
                </h2>
            </div>

            {/* Video Container */}
            <div className="flex flex-row gap-8 items-center justify-center w-full max-w-6xl h-[600px]">

                {/* Partner Video (Main) */}
                <div className="relative flex-1 h-full bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                    {partnerFrame ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={partnerFrame}
                            alt={partnerName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 animate-pulse">
                            Waiting for video...
                        </div>
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full backdrop-blur-md font-medium">
                        {partnerName}
                    </div>
                </div>

                {/* Local Video (Self) */}
                <div className="relative flex-1 h-full bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full backdrop-blur-md font-medium">
                        You
                    </div>
                </div>

            </div>

            {/* Controls */}
            <div className="mt-8 flex gap-4">
                <button
                    onClick={onLeave}
                    className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:scale-105 transition-all"
                >
                    Leave Chat
                </button>
            </div>
        </div>
    );
}
