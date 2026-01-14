import React from "react";
import { useGameStore } from "@/store/useGameStore";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LeaderboardOverlay() {
    const phase = useGameStore((state) => state.phase);
    const leaderboard = useGameStore((state) => state.leaderboard);
    const me = useGameStore((state) => state.me);
    const others = useGameStore((state) => state.others);

    // 1. Only visible after game starts (Not in Lobby)
    if (phase === "LOBBY") {
        return null;
    }

    // 2. Derive display data
    // If leaderboard is empty, assume start of game -> everyone has 0
    let displayData: { username: string; score: number; id: string }[] = [];

    if (leaderboard.length > 0) {
        displayData = leaderboard.map(l => ({
            username: l.username,
            score: l.score,
            id: (l as any).user_id || l.username // Fallback
        }));
    } else {
        // Build from current players
        if (me) {
            displayData.push({ username: me.name, score: me.score || 0, id: me.id });
        }
        others.forEach(p => {
            displayData.push({ username: p.name, score: p.score || 0, id: p.id });
        });
        // Sort alphabetic or random initially? Or just keep order.
        // Let's sort by score (all 0) then name
        displayData.sort((a, b) => a.username.localeCompare(b.username));
    }

    return (
        <div 
            className="fixed top-4 right-4 z-[60] w-72 animate-in slide-in-from-right-10 fade-in duration-500 font-sans"
            style={{ 
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              letterSpacing: "-0.5px"
            }}
        >
            <Card className="bg-white shadow-xl border-2 border-black/10 overflow-hidden rounded-xl">
                <CardHeader className="bg-white border-b border-zinc-100 px-5 py-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500 fill-current" />
                        <span className="font-bold text-lg text-zinc-900 tracking-tight">Leaderboard</span>
                    </div>
                </CardHeader>

                <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                    {displayData.length === 0 ? (
                        <div className="p-6 text-center text-zinc-400 text-sm font-medium"
                        style={{ 
                            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                            letterSpacing: "-0.5px"
                        }}>
                            Waiting for players...
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {displayData.map((entry, index) => {
                                const isMe = entry.id === me?.id || entry.username === me?.name;
                                return (
                                    <div
                                        key={entry.id || index}
                                        className={cn(
                                            "flex items-center justify-between px-5 py-3 transition-colors",
                                            isMe ? "bg-blue-50" : "even:bg-zinc-50/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={cn(
                                                "w-7 h-7 rounded-sm flex items-center justify-center text-xs font-black shrink-0 border-2",
                                                index === 0 ? "bg-yellow-100 border-yellow-400 text-yellow-600" :
                                                index === 1 ? "bg-zinc-100 border-zinc-300 text-zinc-500" :
                                                index === 2 ? "bg-orange-100 border-orange-300 text-orange-500" :
                                                "bg-white border-zinc-200 text-zinc-400"
                                            )}>
                                                {index + 1}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn(
                                                    "truncate font-bold text-sm",
                                                    isMe ? "text-blue-700" : "text-zinc-800"
                                                )}>
                                                    {entry.username || "Unknown"} {isMe && "(You)"}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="font-bold text-zinc-900 text-sm">
                                            {entry.score}pts
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
