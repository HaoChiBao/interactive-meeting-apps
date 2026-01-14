"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TimerProps {
  endTime: number | null; // Timestamp
  onExpire?: () => void;
  className?: string;
}

export function Timer({ endTime, onExpire, className }: TimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endTime) {
      setRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((endTime - now) / 1000));
      
      setRemaining(diff);

      if (diff <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    // Initial call
    const now = Date.now();
    setRemaining(Math.max(0, Math.ceil((endTime - now) / 1000)));

    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className={cn("text-2xl font-mono font-bold", className, remaining < 10 && "text-red-500")}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
