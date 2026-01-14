"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";

interface RecorderProps {
  stream: MediaStream | null;
  onStop: (blob: Blob) => void;
  autoStart?: boolean;
}

export function Recorder({ stream, onStop, autoStart }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (autoStart && stream && !isRecording) {
      startRecording();
    }
  }, [autoStart, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = () => {
    if (!stream) return;
    
    chunksRef.current = [];
    const mr = new MediaRecorder(stream);
    
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      onStop(blob);
      setIsRecording(false);
    };

    mr.start();
    setIsRecording(true);
    mediaRecorderRef.current = mr;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  if (!stream) {
    return <div className="text-muted-foreground text-sm">Waiting for camera...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {!isRecording ? (
        <Button onClick={startRecording} variant="default" className="w-full bg-red-600 hover:bg-red-700">
           <div className="w-3 h-3 rounded-full bg-white mr-2" />
           Record Answer
        </Button>
      ) : (
        <Button onClick={stopRecording} variant="outline" className="w-full border-red-500 text-red-500 hover:bg-red-50">
           <Square className="w-4 h-4 mr-2" />
           Stop Recording
        </Button>
      )}
      {isRecording && (
        <div className="flex items-center gap-2 text-red-600 text-sm animate-pulse">
           <div className="w-2 h-2 rounded-full bg-red-600" />
           Recording...
        </div>
      )}
    </div>
  );
}
