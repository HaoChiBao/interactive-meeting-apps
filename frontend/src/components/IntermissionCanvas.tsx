

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { socketClient } from "@/lib/socket";
import { AvatarStickFigure } from "./AvatarStickFigure";
import { AudioChat } from "./AudioChat";
import { CoffeeChatModal } from "./CoffeeChatModal";
import { cn } from "@/lib/utils";

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

    // Coffee Chat State
    const [incomingInvite, setIncomingInvite] = useState<{ senderId: string, senderName: string } | null>(null);
    const [coffeePartnerId, setCoffeePartnerId] = useState<string | null>(null);
    const [inviteTarget, setInviteTarget] = useState<{ id: string, name: string } | null>(null);

    // Use prop stream
    const stream = localStream || null;

    // Visual state (interpolated positions)
    const [visualState, setVisualState] = useState<Record<string, { x: number, y: number }>>({});

    // Audio volume state for visual indicators
    const [audioVolumes, setAudioVolumes] = useState<Record<string, number>>({});

    // Key state tracking to avoid spamming
    const pressedKeys = useRef<Set<string>>(new Set());

    // Zoom state
    const [zoom, setZoom] = useState(1);

    // Camera/Zoom handlers
    const handleWheel = (e: React.WheelEvent) => {
        // Simple zoom constraint
        setZoom(z => Math.max(0.5, Math.min(2, z - e.deltaY * 0.001)));
    };

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
                    try {
                        socketClient.send("keydown", { key });
                    } catch (err) {
                        console.error("Socket send failed", err);
                    }
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (["w", "a", "s", "d"].includes(key)) {
                pressedKeys.current.delete(key);
                try {
                    socketClient.send("keyup", { key });
                } catch (err) {
                    console.error("Socket send failed", err);
                }
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

    // Local prediction state for ME
    // const myPosRef = useRef<{ x: number, y: number } | null>(null);
    const lastTimeRef = useRef<number>(0);

    // 3. Interpolation Loop (Time-Based)
    useEffect(() => {
        let animationFrameId: number;

        const loop = (time: number) => {
            if (lastTimeRef.current === 0) {
                lastTimeRef.current = time;
                animationFrameId = requestAnimationFrame(loop);
                return;
            }

            const deltaTime = (time - lastTimeRef.current) / 1000; // seconds
            lastTimeRef.current = time;

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
                    const current = prev[p.id] || { x: targetX, y: targetY };

                    // Time-based lerp for framerate independence
                    // Using 15 decay for snappy but smooth interpolation (~150ms catchup)
                    const lerpFactor = 1 - Math.exp(-15 * deltaTime);

                    const newX = lerp(current.x, targetX, lerpFactor);
                    const newY = lerp(current.y, targetY, lerpFactor);

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

        animationFrameId = requestAnimationFrame(loop);
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

    // Center the camera on "me", accounting for zoom scale
    const camOffsetX = centerX - myVisualPos.x * zoom;
    const camOffsetY = centerY - myVisualPos.y * zoom;

    return (
        <div className={cn("fixed inset-0 z-50 bg-[#F0F0F0] overflow-hidden", className)}>
            {/* Grid Background - moves with camera */}
            <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                    backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                    backgroundSize: `${50 * zoom}px ${50 * zoom}px`, // Scale grid with zoom
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

            {/* WASD Hint */}
            <div className="absolute bottom-8 left-8 bg-white/50 p-3 rounded-xl shadow-sm backdrop-blur-sm text-xs font-medium text-slate-500 border border-slate-100/50 z-40">
                Use <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 mx-0.5 shadow-[0_1px_0_rgba(0,0,0,0.1)]">WASD</kbd> to move
            </div>

            {/* Render Players */}
            <div
                className="absolute origin-top-left will-change-transform"
                style={{
                    transform: `translate3d(${camOffsetX}px, ${camOffsetY}px, 0) scale(${zoom})`,
                }}
            >
                {Object.entries(visualState).map(([id, pos]) => {
                    const isMe = me?.id === id;
                    const p = isMe ? me : others.find(o => o.id === id);
                    if (!p) return null;

                    return (
                        <div key={id}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                                left: pos.x,
                                top: pos.y,
                                zIndex: Math.floor(pos.y),
                            }}
                        >
                            <AvatarStickFigure
                                name={p.name}
                                isMe={isMe}
                                stream={isMe ? stream : undefined}
                                cameraEnabled={p.cameraEnabled}
                                lastVideoFrame={p.lastVideoFrame}
                                className={!isMe ? "cursor-pointer" : ""}
                                onClick={() => !isMe && setInviteTarget({ id: p.id, name: p.name })}
                                volume={audioVolumes[id] || 0}
                            />
                        </div>
                    );
                })}
            </div>

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

            {/* Minimap (Bottom Right) */}
            <div className="absolute bottom-8 right-8 w-48 h-36 bg-white/90 border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 opacity-90 hidden md:block">
                {/* Dynamic Minimap Calculation */}
                {(() => {
                    const players = Object.values(visualState);
                    if (players.length === 0) return null;

                    // 1. Calculate Bounding Box
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    players.forEach(p => {
                        if (p.x < minX) minX = p.x;
                        if (p.x > maxX) maxX = p.x;
                        if (p.y < minY) minY = p.y;
                        if (p.y > maxY) maxY = p.y;
                    });

                    // Add some padding (world units) around the extremes ? 
                    // Or ensure min size (e.g. if one player, don't zoom to infinity)
                    const padding = 600; // minimum world view width/height (increased to prevent too-close zoom)
                    const width = Math.max(maxX - minX, padding);
                    const height = Math.max(maxY - minY, padding);

                    // 2. Calculate Fit
                    const mapW = 192; // w-48
                    const mapH = 144; // h-36
                    const scaleX = mapW / (width + 100); // +100 margin
                    const scaleY = mapH / (height + 100);
                    const scale = Math.min(scaleX, scaleY, 0.5); // Cap max zoom (0.5 is 2x zoom out compared to 1.0)

                    // 3. Center Point
                    const cx = (minX + maxX) / 2;
                    const cy = (minY + maxY) / 2;

                    return (
                        <div className="relative w-full h-full bg-slate-50"
                            style={{
                                backgroundImage: "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
                                backgroundSize: `${50 * scale}px ${50 * scale}px`,
                                backgroundPosition: "center"
                            }}
                        >
                            {/* Debug Center helper (optional, can remove) */}
                            {/* <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500/20 rounded-full -translate-x-1/2 -translate-y-1/2" /> */}

                            {Object.entries(visualState).map(([id, pos]) => {
                                const isMe = me?.id === id;

                                // Transform world -> minimap
                                // (pos - center) * scale + mapCenter
                                const miniX = (pos.x - cx) * scale + (mapW / 2);
                                const miniY = (pos.y - cy) * scale + (mapH / 2);

                                // No clamping needed if we auto-fit? 
                                // Actually, we might still want clamping if scale cap is hit.
                                const clampedX = Math.max(5, Math.min(mapW - 5, miniX));
                                const clampedY = Math.max(5, Math.min(mapH - 5, miniY));

                                return (
                                    <div key={id}
                                        className={cn(
                                            "absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-sm border border-white/50",
                                            isMe ? "bg-indigo-500 z-10" : "bg-slate-400"
                                        )}
                                        style={{ left: clampedX, top: clampedY }}
                                    />
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

            <AudioChat
                visualState={visualState}
                onVolumeChange={(vols) => setAudioVolumes(vols)}
                privatePeerId={coffeePartnerId}
            />
        </div>
    );
}
