"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";

export default function Home() {
    const router = useRouter();
    const [createName, setCreateName] = useState("");
    const [joinName, setJoinName] = useState("");
    const [roomCode, setRoomCode] = useState("");

    const handleCreate = () => {
        if (!createName.trim()) return;
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem("interview-royale-name", createName);
        router.push(`/preflight?code=${code}&create=true`);
    };

    const handleJoin = () => {
        if (!joinName.trim() || !roomCode.trim()) return;
        localStorage.setItem("interview-royale-name", joinName);
        router.push(`/preflight?code=${roomCode}`);
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 text-zinc-900 font-sans">
            <h1 className="text-4xl font-bold mb-10 text-zinc-800 tracking-tight">
                Coffee Chat Simulator
            </h1>

            <div className="flex flex-col md:flex-row gap-12 w-full max-w-2xl justify-center items-start">

                {/* Host */}
                <div className="flex flex-col gap-4 w-full md:w-64">
                    <h2 className="text-xl font-semibold text-zinc-700">Host a Café</h2>
                    <input
                        className="w-full p-2 border border-zinc-300 rounded bg-white text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
                        placeholder="Your Name"
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!createName.trim()}
                        className="w-full py-2 bg-zinc-800 text-white rounded font-medium disabled:opacity-50 hover:bg-zinc-700 transition-colors"
                    >
                        Create Room
                    </button>
                </div>

                {/* Divider for mobile/desktop */}
                <div className="hidden md:block w-px h-48 bg-zinc-200"></div>

                {/* Join */}
                <div className="flex flex-col gap-4 w-full md:w-64">
                    <h2 className="text-xl font-semibold text-zinc-700">Join a Café</h2>
                    <input
                        className="w-full p-2 border border-zinc-300 rounded bg-white text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
                        placeholder="Your Name"
                        value={joinName}
                        onChange={e => setJoinName(e.target.value)}
                    />
                    <input
                        className="w-full p-2 border border-zinc-300 rounded bg-white text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 uppercase font-mono"
                        placeholder="ROOM CODE"
                        maxLength={6}
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    />
                    <button
                        onClick={handleJoin}
                        disabled={!joinName.trim() || !roomCode.trim()}
                        className="w-full py-2 bg-zinc-800 text-white rounded font-medium disabled:opacity-50 hover:bg-zinc-700 transition-colors"
                    >
                        Join Room
                    </button>
                </div>
            </div>
        </main>
    );
}
