

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { socketClient } from "@/lib/socket";
import { AvatarStickFigure } from "./AvatarStickFigure";
import { AudioChat } from "./AudioChat";
import { CoffeeChatModal } from "./CoffeeChatModal";
import { cn } from "@/lib/utils";
import { LeaderboardOverlay } from "./LeaderboardOverlay";

// Linear interpolation helper
const lerp = (start: number, end: number, t: number) => {
    return start * (1 - t) + end * t;
};

interface IntermissionCanvasProps {
    localStream?: MediaStream | null;
    className?: string; // Allow custom styling/z-index
}

export function IntermissionCanvas({ localStream, className }: IntermissionCanvasProps) {
    const me = useGameStore(s => s.me);
    const others = useGameStore(s => s.others);
    const phase = useGameStore(s => s.phase);
    const intermissionEndTime = useGameStore(s => s.intermissionEndTime);

    // Coffee Chat State
    const [incomingInvite, setIncomingInvite] = useState<{ senderId: string, senderName: string } | null>(null);
    const [coffeePartnerId, setCoffeePartnerId] = useState<string | null>(null);
    const [inviteTarget, setInviteTarget] = useState<{ id: string, name: string } | null>(null);

    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const updateTimer = () => {
            if (!intermissionEndTime) {
                setTimeLeft(0);
                return;
            }
            const diff = Math.max(0, Math.floor((intermissionEndTime - Date.now()) / 1000));
            setTimeLeft(diff);
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [intermissionEndTime]);

    // Use prop stream
    const stream = localStream || null;

    // Visual state (interpolated positions)
    const [visualState, setVisualState] = useState<Record<string, { x: number, y: number }>>({});

    // Audio volume state for visual indicators
    const [audioVolumes, setAudioVolumes] = useState<Record<string, number>>({});

    // Key state tracking to avoid spamming
    const pressedKeys = useRef<Set<string>>(new Set());

    // 2. Input Handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;

            const key = e.key.toLowerCase();
            if (["w", "a", "s", "d"].includes(key)) {
                if (!pressedKeys.current.has(key)) {
                    pressedKeys.current.add(key);
                    socketClient.send("keydown", { key });
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
             // We generally want to allow keyup even if focused, to clear state, 
             // but strictly speaking if they focused input while holding, it might get stuck.
             // For now, let's just let keyup pass through or apply same check.
             // Better to let keyup pass so we don't get stuck keys if they ctrl-tab or click away.
            const key = e.key.toLowerCase();
            if (["w", "a", "s", "d"].includes(key)) {
                pressedKeys.current.delete(key);
                socketClient.send("keyup", { key });
            }
        };

        const handleBlur = () => {
            // Clear all pressed keys on window blur to prevent "stuck" keys
            pressedKeys.current.forEach(key => {
                socketClient.send("keyup", { key });
            });
            pressedKeys.current.clear();
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", handleBlur);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", handleBlur);
        };
    }, []);

    // 2.5 Coffee Chat Signaling
    useEffect(() => {
        const handleMsg = (e: CustomEvent) => {
            const data = e.detail;

            if (data.type === "coffee_invite") {
                setIncomingInvite({ senderId: data.sender_id, senderName: data.sender_name });
            }
            else if (data.type === "coffee_start") {
                setCoffeePartnerId(data.partner_id);
                setIncomingInvite(null); // Clear invite if accepted
            }
            else if (data.type === "coffee_ended") {
                setCoffeePartnerId(null);
            }
        };

        window.addEventListener("game_socket_message" as any, handleMsg);
        return () => window.removeEventListener("game_socket_message" as any, handleMsg);
    }, []);

    // Refs for loop access
    const latestMe = useRef(me);
    const latestOthers = useRef(others);

    useEffect(() => {
        latestMe.current = me;
        latestOthers.current = others;
    }, [me, others]);

    // 3. Interpolation & Prediction Loop
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            setVisualState(prev => {
                const nextState: Record<string, { x: number, y: number }> = {};

                const curMe = latestMe.current;
                const curOthers = latestOthers.current;

                // Combine me and others
                const allPlayers = [
                    ...(curMe ? [curMe] : []),
                    ...curOthers
                ];

                allPlayers.forEach(p => {
                    // Target pos from server/store
                    const targetX = p.x ?? 400;
                    const targetY = p.y ?? 300;

                    // Current visual pos
                    const current = prev[p.name] || { x: targetX, y: targetY };

                    // Interpolate (lerp) for everyone including me
                    // Using 0.1 for smooth catch-up to 20hz server updates
                    const newX = lerp(current.x, targetX, 0.1);
                    const newY = lerp(current.y, targetY, 0.1);

                    // Snap if very close to avoid micro-jitter
                    if (Math.abs(newX - targetX) < 1 && Math.abs(newY - targetY) < 1) {
                        nextState[p.id] = { x: targetX, y: targetY };
                    } else {
                        nextState[p.id] = { x: newX, y: newY };
                    }
                });

                return nextState;
            });

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, []); // Run ONCE on mount

    // Track viewport size for centering
    const [viewport, setViewport] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const handleResize = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight });
        };
        handleResize(); // Init
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Helper to get my current visual position
    const myVisualPos = me && visualState[me.id] ? visualState[me.id] : { x: 400, y: 300 };

    // Calculate Camera Offset
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    const camOffsetX = centerX - myVisualPos.x;
    const camOffsetY = centerY - myVisualPos.y;

    return (
        <div className={cn("fixed inset-0 z-50 bg-[#F0F0F0] overflow-hidden", className)}>
             {/* Grid Background */}
             <div className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{ 
                      backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", 
                      backgroundSize: "50px 50px",
                      // Move background opposite to player movement (or rather, fixed to world space)
                      backgroundPosition: `${camOffsetX}px ${camOffsetY}px` 
                  }} 
             />

            {/* LEADER BADGE (Top Center) */}
            {me?.isLeader && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-1.5 rounded-full shadow-sm text-xs font-medium backdrop-blur-md z-50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"
                    style={{ 
                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        letterSpacing: "-.50px", lineHeight: "1.00"
                    }} />
                    You are the leader
                </div>
            )}

            {/* MAIN INTERMISSION PANEL (Bottom Center) - Compact & Sleek */}
            {/* HIDE IN LOBBY AND ROUND */}
            {phase !== "LOBBY" && phase !== "ROUND" && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white/95 px-6 py-4 rounded-2xl shadow-2xl shadow-black/5 border border-zinc-100 z-50 flex flex-col items-center gap-1.5 backdrop-blur-sm min-w-[240px]">
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight"
                    style={{ 
                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        letterSpacing: "-.50px", lineHeight: "1.00"
                    }}
                    >   
                        Intermission
                    </h2>
                    
                    <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium"
                    style={{ 
                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        letterSpacing: "-.50px", lineHeight: "1.00"
                    }}
                    >
                        {timeLeft > 0 ? (   
                            <>
                                <span>Next round in</span>
                                <span className="font-mono text-zinc-900 font-bold bg-zinc-100 px-1.5 py-0.5 rounded text-xs">
                                    {Math.floor(timeLeft / 60)}:{((timeLeft % 60) + "").padStart(2, "0")}
                                </span>
                            </>
                        ) : (
                            <span>Starting soon...</span>
                        )}
                    </div>

                    {/* Leader Controls (Inside Bottom Panel) */}
                    {me?.isLeader && timeLeft > 0 && (
                        <button
                            onClick={() => socketClient.send("skip_intermission", {})}
                            className="mt-2 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 text-xs font-semibold px-4 py-1.5 rounded-full border border-zinc-200 shadow-sm transition-all hover:border-zinc-300 active:scale-95 flex items-center gap-1.5 group"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                        >
                            Skip Wait
                            <svg className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* WASD Hint (Bottom Left - moved up slightly to avoid conflict if screen small, or keep but ensure z-index) */}
            <div className="absolute bottom-8 left-8 bg-white/50 p-3 rounded-xl shadow-sm backdrop-blur-sm text-xs font-medium text-slate-500 border border-slate-100/50">
                Use <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 mx-0.5 shadow-[0_1px_0_rgba(0,0,0,0.1)]">WASD</kbd> to move
            </div>

            {/* DEBUG OVERLAY */}
            {/* <div className="absolute top-20 left-8 bg-black/50 text-white text-xs p-2 pointer-events-none max-w-sm overflow-hidden">
                 Me: {me?.name} (Submitted: {String(me?.hasSubmitted)})<br/>
                 Others: {others.length}<br/>
                 Visual: {Object.keys(visualState).join(", ")}<br/>
                 Pos: {me?.name && JSON.stringify(visualState[me.name])}<br/>
                 Cam: {Math.round(camOffsetX)}, {Math.round(camOffsetY)}
             </div> */}

            {/* Render Players */}
            {Object.entries(visualState).map(([id, pos]) => {
                const isMe = me?.id === id;
                const player = isMe ? me : others.find(o => o.id === id);

                // Check condition: Show if Me, if Submitted, OR IF LEADER.
                // Also always show in LOBBY.
                const shouldShow = isMe || phase === "LOBBY" || player?.hasSubmitted || player?.isLeader;

                if (!shouldShow) return null;

                // Apply camera offset
                const screenX = pos.x + camOffsetX;
                const screenY = pos.y + camOffsetY;

                return (
                    <div
                        key={`${id}-${isMe ? 'me' : 'other'}`}
                        className="absolute"
                        style={{
                            transform: `translate(${screenX}px, ${screenY}px)`,
                            // Center the pivot
                            marginLeft: -112, // Half of width (224/2)
                            marginTop: -112   // Half of height (224/2)
                        }}
                    >
                        <AvatarStickFigure
                            name={player?.name || "Unknown"}
                            isMe={isMe}
                            stream={isMe ? stream : null}
                            cameraEnabled={true}
                            lastVideoFrame={player?.lastVideoFrame}
                            isMoving={player?.isMoving}
                            facingRight={player?.facingRight}
                            volume={audioVolumes[player?.id || ""]}
                            isChatting={player?.isChatting}
                            onClick={() => {
                                if (!isMe && player?.id) {
                                    setInviteTarget({ id: player.id, name: player.name });
                                }
                            }}
                        />
                    </div>
                );
            })}

            {/* MINIMAP */}
            {(() => {
                // Identify all players to show on minimap
                const minimapPlayers = [];
                if (me) minimapPlayers.push(me);
                others.forEach(p => {
                    if (p.hasSubmitted || p.isLeader) minimapPlayers.push(p);
                });

                if (minimapPlayers.length === 0) return null;

                // Calculate bounds
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                minimapPlayers.forEach(p => {
                    // Use visual state if available for smoothness, otherwise raw
                    const v = visualState[p.name] || { x: p.x || 400, y: p.y || 300 };
                    if (v.x < minX) minX = v.x;
                    if (v.x > maxX) maxX = v.x;
                    if (v.y < minY) minY = v.y;
                    if (v.y > maxY) maxY = v.y;
                });

                // Add padding
                const PAD = 100; // World units
                minX -= PAD; maxX += PAD;
                minY -= PAD; maxY += PAD;

                // Enforce minimum size (e.g. 2000x2000) so it doesn't zoom in crazy close
                const MIN_SIZE = 2000;
                const w = maxX - minX;
                const h = maxY - minY;

                if (w < MIN_SIZE) {
                    const diff = MIN_SIZE - w;
                    minX -= diff / 2;
                    maxX += diff / 2;
                }
                if (h < MIN_SIZE) {
                    const diff = MIN_SIZE - h;
                    minY -= diff / 2;
                    maxY += diff / 2;
                }

                const finalW = maxX - minX;
                const finalH = maxY - minY;

                // Map size
                const mapSize = 140;

                return (
                    <div className="absolute bottom-6 right-6 w-[140px] h-[140px] bg-white/90 border-2 border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden pointer-events-none">
                        {/* Grid inside map */}
                        <div className="absolute inset-0 opacity-20"
                            style={{
                                backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                                backgroundSize: "14px 14px"
                            }}
                        />

                        {minimapPlayers.map(p => {
                            const v = visualState[p.id] || { x: p.x || 400, y: p.y || 300 };
                            const isMe = p.id === me?.id;

                            // Normalize 0..1
                            const nx = (v.x - minX) / finalW;
                            const ny = (v.y - minY) / finalH;

                            return (
                                <div
                                    key={`${p.id}-${isMe ? 'me' : 'other'}`}
                                    className={cn(
                                        "absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2",
                                        isMe ? "bg-green-500 z-10 w-2.5 h-2.5 ring-1 ring-white" : "bg-indigo-400"
                                    )}
                                    style={{
                                        left: `${nx * 100}%`,
                                        top: `${ny * 100}%`
                                    }}
                                />
                            );
                        })}
                    </div>
                );
            })()}


            {/* Outgoing Invite Popup */}
            {inviteTarget && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200 border border-slate-200 max-w-sm w-full">
                    <div className="text-xl font-bold text-slate-800">Start Coffee Chat?</div>
                    <div className="text-center text-slate-600">
                        Invite <span className="font-bold text-indigo-600">{inviteTarget.name}</span> to a private breakout room?
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button
                            onClick={() => {
                                socketClient.sendCoffeeInvite(inviteTarget.id);
                                setInviteTarget(null);
                            }}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                        >
                            Send Invite
                        </button>
                        <button
                            onClick={() => setInviteTarget(null)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl font-bold transition-colors"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Coffee Invite Overlay */}
            {incomingInvite && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-xl shadow-2xl p-4 flex flex-col items-center gap-4 animate-in slide-in-from-top-4 border-2 border-indigo-500">
                    <div className="text-lg font-bold text-slate-800"
                    style={{ 
                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        letterSpacing: "-.50px", lineHeight: "1.00"
                    }}
                    >
                        ☕ Coffee Chat Request
                    </div>
                    <div className="text-sm text-slate-600"
                    style={{ 
                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        letterSpacing: "-.50px", lineHeight: "1.00"
                    }}
                    >
                        <span className="font-bold text-indigo-600">{incomingInvite.senderName}</span> wants to chat privately.
                    </div>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={() => {
                                socketClient.acceptCoffeeInvite(incomingInvite.senderId);
                                setIncomingInvite(null); // Wait for coffee_start to swap UI
                            }}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold shadow transition-colors"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => setIncomingInvite(null)}
                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg font-bold transition-colors"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                        >
                            Decline
                        </button>
                    </div>
                </div>
            )}

            {/* Coffee Chat Modal */}
            {coffeePartnerId && (
                <CoffeeChatModal
                    partnerName={others.find(o => o.id === coffeePartnerId)?.name || "Partner"}
                    partnerFrame={others.find(o => o.id === coffeePartnerId)?.lastVideoFrame}
                    localStream={stream}
                    onLeave={() => {
                        socketClient.leaveCoffeeChat(coffeePartnerId);
                        setCoffeePartnerId(null);
                    }}
                />
            )}

            <LeaderboardOverlay />

            <AudioChat
                visualState={visualState}
                onVolumeChange={(vols) => setAudioVolumes(vols)}
                privatePeerId={coffeePartnerId}
            />
        </div>
    );
}
