"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { socketClient } from "@/lib/socket";
import { Trophy, ArrowRight, Home } from "lucide-react";
import { AvatarStickFigure } from "@/components/AvatarStickFigure";
import { PlayerGrid } from "@/components/PlayerGrid";
import { IntermissionCanvas } from "@/components/IntermissionCanvas";
import { LeaderboardOverlay } from "@/components/LeaderboardOverlay";
import titleImage from "@/assets/title.png";
import { getMediaStream } from "@/lib/media";

export default function ResultsPage() {
    const router = useRouter();
    const { code } = useParams();

    const {
        phase,
        others,
        me,
        leaderboard,
        gameSettings,
        intermissionDuration
    } = useGameStore();

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    // Acquire media for "Me" avatar
    useEffect(() => {
        let mounted = true;
        getMediaStream(true, true).then(s => {
            if (mounted) setLocalStream(s);
        }).catch(e => console.error(e));

        return () => {
            mounted = false;
        };
    }, []);

    const handleHome = () => {
        window.location.href = "/";
    };

    // Calculate podium and list
    // Leaderboard has { username, score }
    // We need to map this to Player objects from `others` and `me` to get video frames
    const fullLeaderboard = leaderboard.map((entry) => {
        const isMe = entry.username === me?.name;
        // Find player object
        const player = isMe ? me : others.find(p => p.name === entry.username);
        return {
            ...entry,
            isMe,
            playerObj: player
        };
    });

    const top3 = fullLeaderboard.slice(0, 3);
    const rest = fullLeaderboard.slice(3);

    const myScore = leaderboard.find(l => l.username === me?.name)?.score || 0;

    return (
        <main 
            className="min-h-screen flex flex-col items-center justify-center p-8 bg-white text-zinc-900 font-sans overflow-hidden"
            style={{ 
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              letterSpacing: "-0.5px"
            }}
        >
            <LeaderboardOverlay />
            
            {/* 1. Header: Logo (Increased z-index to stay on top if needed, increased margin) */}
            <div className="mb-4 relative z-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={titleImage.src} alt="Interview Royale" className="h-28 md:h-36 object-contain" />
            </div>

            {/* 2. My Score (Moved WAY up to avoid overlap) */}
            <h2 className="text-3xl font-bold mb-25 relative z-40"
                style={{
                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                    letterSpacing: "-0.5px"
                }}
            >
                Your Score: <span className="text-blue-500">{myScore}pts</span>
            </h2>

            {/* 3. Main Content: Podium + List */}
            <div className="flex flex-col md:flex-row items-end justify-center gap-3 mb-16 w-full max-w-6xl px-4">
                
                {/* Podium Container - Compact height */}
                <div className="relative flex items-end justify-center h-[300px] w-full max-w-2xl">
                    
                    {/* #2 (Left, Tilted -6deg) */}
                    {top3[1] && (
                        <div className="absolute left-0 bottom-4 z-20 transform -rotate-8 transition-transform hover:rotate-0 duration-300 origin-bottom-right">
                             <div className="bg-white px-2 pt-2 pb-3 rounded-sm shadow-xl border-2 border-[#C0C0C0] w-[200px] md:w-[250px] flex flex-col items-center"
                             style={{
                                boxShadow: "0px 3.35px 10.19px 5.05px #C0C0C0"
                                    

 }}>
                                {/* Avatar Container - Allow overflow for head */}
                                <div className="bg-[#E5E7EB] w-full aspect-[16/10] rounded-sm mb-3 flex items-end justify-center relative">
                                     <div className="absolute -bottom-6 transform scale-110">
                                        <AvatarStickFigure 
                                            name=""
                                            isMe={top3[1].isMe}
                                            stream={top3[1].isMe ? localStream : null}
                                            lastVideoFrame={top3[1].playerObj?.lastVideoFrame}
                                            cameraEnabled={true}
                                            hideNameTag={true}
                                        />
                                     </div>
                                </div>
                                <div className="text-center w-full px-1"
                                style={{
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-0.5px"
                                }}>
                                    <div className="text-5xl font-bold text-[#C9C9C9] leading-none mb-0.5">#2</div>
                                    <div className="text-lg font-semibold text-zinc-700 leading-tight truncate w-full">
                                        {top3[1].username}: {top3[1].score}pts
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}

                    {/* #3 (Right, Tilted +6deg) */}
                    {top3[2] && (
                        <div className="absolute right-0 bottom-4 z-10 transform rotate-6 transition-transform hover:rotate-0 duration-300 origin-bottom-left">
                             <div className="bg-white px-2 pt-2 pb-3 rounded-sm
 border-2 border-[#E1925D] w-[200px] md:w-[250px] flex flex-col items-center"
 style={{
    boxShadow: "0px 3.35px 10.19px 5.05px #BD520A"

 }}>
                                <div className="bg-[#E1925D] w-full aspect-[16/10] rounded-sm mb-3 flex items-end justify-center relative">
                                    <div className="absolute -bottom-6 transform scale-110">
                                        <AvatarStickFigure 
                                            name=""
                                            isMe={top3[2].isMe}
                                            stream={top3[2].isMe ? localStream : null}
                                            lastVideoFrame={top3[2].playerObj?.lastVideoFrame}
                                            cameraEnabled={true}
                                            hideNameTag={true}
                                        />
                                    </div>
                                </div>
                                <div className="text-center w-full px-1"
                                style={{
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-0.5px"
                                }}>
                                    <div className="text-5xl font-bold text-[#BD520A] leading-none mb-0.5">#3</div>
                                    <div className="text-lg font-bold text-zinc-700 leading-tight truncate w-full">
                                        {top3[2].username}: {top3[2].score}pts
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}

                    {/* #1 (Center, Straight, Scale 1.1) */}
                    {top3[0] && (
                        <div className="absolute bottom-6 z-30 transform scale-110 transition-transform hover:scale-105 duration-300">
                             <div className="bg-white px-3 pt-3 pb-5 rounded-sm shadow-2xl border-2 border-[#F5C518] w-[200px] md:w-[250px] flex flex-col items-center"
                             style={{
                                boxShadow: "0px 3.35px 10.19px 5.05px #D8A728"
                             }}>
                                <div className="bg-[#FDE4A1] w-full aspect-[16/10] rounded-sm mb-4 flex items-end justify-center relative">
                                     <div className="absolute -bottom-4 transform scale-125">
                                         <AvatarStickFigure 
                                            name=""
                                            isMe={top3[0].isMe}
                                            stream={top3[0].isMe ? localStream : null}
                                            lastVideoFrame={top3[0].playerObj?.lastVideoFrame}
                                            cameraEnabled={true}
                                            hideNameTag={true}
                                        />
                                     </div>
                                </div>
                                <div className="text-center w-full px-1" 
                                style={{
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-0.5px"
                                }}>
                                    <div className="text-6xl font-bold text-[#D8A728] leading-none mb-0.5">#1</div>
                                    <div className="text-xl font-bold text-zinc-800 leading-tight truncate w-full">
                                        {top3[0].username} {top3[0].isMe ? "(You)" : ""}: {top3[0].score}pts
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                {/* Leaderboard List (Right side) */}
                {rest.length > 0 && (
                    <div className="flex flex-col gap-2 w-full max-w-xs pl-8 border-l-2 border-zinc-100/50">
                        {rest.map((entry, idx) => (
                            <div key={entry.username} className="flex items-center gap-4 bg-zinc-100 px-4 py-3 rounded-sm w-full">
                                <span className="font-black text-zinc-800 text-lg">#{idx + 4}</span>
                                <div className="flex-1 font-bold text-zinc-500 flex justify-between">
                                    <span>{entry.username}</span>
                                    <span>{entry.score}pts</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. Footer: Back Button */}
            <Button 
                onClick={handleHome}
                className="bg-black text-white hover:bg-zinc-800 text-xl px-10 py-6 rounded-xl font-medium shadow-xl transition-transform hover:scale-105 active:scale-95"
            >
                Back To Home
            </Button>

        </main>
    );
}
