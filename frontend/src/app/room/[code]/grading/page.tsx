"use client";

import React, { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Timer } from "@/components/Timer"; // Should we show timer or just waiting?
import { Loader2, BrainCircuit } from "lucide-react";

export default function GradingPage() {
  const router = useRouter();
  const { code } = useParams();
  const phase = useGameStore(s => s.phase);
  const others = useGameStore(s => s.others);
  const me = useGameStore(s => s.me);

  useEffect(() => {
    if (phase === "RESULTS") {
      router.push(`/room/${code}/results`);
    }
  }, [phase, code, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-black text-white">
      <div className="flex flex-col items-center gap-8 animate-in fade-in duration-700">
         <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
            <BrainCircuit className="w-24 h-24 text-indigo-400 animate-pulse" />
         </div>
         
         <div className="text-center space-y-2">
           <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
             AI Grading in Progress...
           </h1>
           <p className="text-zinc-400">Analyzing sentiment, confidence, and keyword density.</p>
         </div>

         <div className="grid grid-cols-3 gap-2 mt-8">
            {/* Visual indicators of who finished */}
            {[me, ...others].map((p, i) => (
               <div key={p?.id || i} className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
         </div>
      </div>
    </main>
  );
}
