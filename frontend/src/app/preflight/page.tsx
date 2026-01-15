"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { AvatarStickFigure } from "@/components/AvatarStickFigure";
import { getMediaStream } from "@/lib/media";
import { Loader2, Mic, Video, VideoOff } from "lucide-react";

function PreflightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [name, setName] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Load name from local storage
  useEffect(() => {
    const storedName = localStorage.getItem("interview-royale-name");
    if (storedName) setName(storedName);
  }, []);

  // Initialize camera
  useEffect(() => {
    let mounted = true;

    async function initMedia() {
      try {
        const s = await getMediaStream(true, true);
        if (mounted) {
          setStream(s);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error(err);
          setError("Could not access camera/microphone. Please allow permissions.");
          setCameraEnabled(false);
        }
      }
    }

    initMedia();

    return () => {
      mounted = false;
      // Stop local stream here to avoid flash, re-acquire in Lobby
      // stream?.getTracks().forEach(t => t.stop()); 
      // Actually correct behavior: allow clean unmount
    };
  }, []);

  // Toggle helpers
  const toggleVideo = () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCameraEnabled(track.enabled);
      }
    }
  };

  const handleEnter = () => {
    if (!code || !name) return;

    // Stop local stream before navigating
    stream?.getTracks().forEach(t => t.stop());

    // Set name in store
    useGameStore.getState().setMe(name);

    router.push(`/room/${code}`);
  };

  if (!name || !code) {
    return <div className="p-8">Invalid session. Go back home.</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 text-zinc-900 font-sans">
      <h1 className="text-4xl font-bold mb-10 text-zinc-800 tracking-tight">
        Setup Your Avatar
      </h1>

      <div className="flex flex-col items-center gap-8 w-full max-w-md">

        {/* Avatar Container */}
        <div className="relative flex justify-center items-center w-full h-[220px] bg-zinc-100 rounded-lg border border-zinc-200">
          <div className="transform scale-110">
            <AvatarStickFigure
              name={name}
              isMe={true}
              stream={stream}
              hideNameTag={true}
              cameraEnabled={cameraEnabled}
            />
          </div>

          {/* Simple Name Tag */}
          <div className="absolute top-4 right-4 text-xs font-medium text-zinc-500">
            {name} (You)
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="flex gap-4">
            <button
              onClick={toggleVideo}
              disabled={!stream}
              className={`p-3 rounded-full transition-colors flex items-center justify-center ${cameraEnabled ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <div className="p-3 rounded-full border border-zinc-200 bg-white text-zinc-300">
              <Mic className="w-5 h-5" />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500 text-center bg-red-50 px-3 py-1 rounded">
              {error}
            </div>
          )}

          <div className="w-full space-y-2">
            <button
              onClick={handleEnter}
              className="w-full py-3 bg-zinc-800 text-white rounded-md font-medium text-lg hover:bg-zinc-700 transition-colors"
            >
              Enter Lobby
            </button>
            <div className="text-center text-zinc-400 text-sm font-mono">
              CODE: {code}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

export default function PreflightPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>}>
      <PreflightContent />
    </Suspense>
  );
}
