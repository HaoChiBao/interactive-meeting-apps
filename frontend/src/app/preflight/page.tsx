"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { AvatarStickFigure } from "@/components/AvatarStickFigure";
import { getMediaStream } from "@/lib/media";
import { Loader2, Mic, Video, VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import Image from "next/image";
// @ts-ignore
import titleImage from "@/assets/title.png";

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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 text-zinc-900 font-sans">
      {/* Banner Title */}
      <div className="mb-8">
          <Image src={titleImage} alt="Interview Royale" width={300} height={80} className="w-auto h-16 object-contain opacity-90" />
      </div>

      <Card className="w-full max-w-md shadow-xl shadow-blue-100/50 border-2 border-blue-100 overflow-visible bg-white">
        <CardContent className="pt-12 pb-8 px-8 flex flex-col items-center gap-6">
          <h1 className="text-5xl font-bold tracking-tight text-[#4294DD]" style={{ 
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-.50px", lineHeight: "1.00"
                                }}>Setup Your Avatar</h1>
          
          {/* Avatar Container */}
          <div className="relative flex justify-center items-center w-full h-[220px] bg-zinc-100/50 rounded-2xl border border-zinc-100">
            <div className="transform scale-120 origin-center">
                <AvatarStickFigure
                  name={name}
                  isMe={true}
                  stream={stream} 
                  hideNameTag={true}
                  cameraEnabled={cameraEnabled}
                />
            </div>
            
            {/* Name Badge */}
            <div className="absolute top-3 right-3 bg-white/90 text-zinc-800 text-xs px-2.5 py-1 rounded-md font-medium shadow-sm border border-zinc-200/50 backdrop-blur-sm"
            style={{
                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                    letterSpacing: "-.50px", lineHeight: "1.00"
                }}>
                {name} <span className="text-zinc-400 ml-1"
                >(You)</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 w-full">
              {/* Controls */}
              <div className="flex gap-3">
                 <Button 
                    size="icon" 
                    onClick={toggleVideo} 
                    disabled={!stream}
                    className={`rounded-full w-10 h-10 transition-colors ${cameraEnabled ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-red-500 hover:bg-red-600'}`}
                 >
                   {cameraEnabled ? <Video className="w-4 h-4 text-white" /> : <VideoOff className="w-4 h-4 text-white" />}
                 </Button>
                 <Button 
                    size="icon" 
                    disabled 
                    variant="outline"
                    className="rounded-full w-10 h-10 border-zinc-200 bg-white"
                 >
                   <Mic className="w-4 h-4 text-zinc-400" />
                 </Button>
              </div>

              {error && (
                <div className="text-xs text-red-500 text-center font-medium bg-red-50 px-3 py-1 rounded-md">
                  {error}
                </div>
              )}
              
              <div className="text-sm text-zinc-400 font-medium font-inter mt-1"
                style={{ 
                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                    letterSpacing: "-.50px", lineHeight: "1.00"
                }}
              >
                 Room Code: <span className="font-inter text-zinc-600">{code}</span>
              </div>

              <Button 
                className="w-full text-xl font-bold h-12 rounded-lg shadow-lg shadow-blue-400/10 mt-2 transition-all active:scale-[0.98] border-2 border-[#4294DD] bg-white text-[#4294DD] hover:bg-[#4294DD] hover:text-white" 
                style={{ 
                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", 
                    letterSpacing: "-.50px", 
                    lineHeight: "1.00" 
                }}
                onClick={handleEnter}
              >
                Enter Lobby
              </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-xs text-zinc-300 font-medium">
          Ready to interview?
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
