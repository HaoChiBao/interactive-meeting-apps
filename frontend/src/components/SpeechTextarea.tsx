"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpeechTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SpeechTextarea({ 
  value, 
  onChange, 
  placeholder = "Type your answer here...", 
  className,
  disabled
}: SpeechTextareaProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Keep track of the *current* full value so 'onresult' can append to the latest version
  // even if the closure was created earlier.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
             // Append to the LATEST value
             const currentValue = valueRef.current;
             const separator = (currentValue && !currentValue.endsWith(" ")) ? " " : "";
             const newValue = currentValue + separator + finalTranscript;
             
             // Update parent
             onChange(newValue);
          }
        };

        recognition.onend = () => {
           // If we didn't manually stop, maybe restart? 
           // For now, let's just sync state.
           // If we wanted aggressive continuous listening, we'd check a ref here.
           // But 'setIsListening' might be stale if inside closure? No, setState is stable.
           // However, let's trust the user to toggle.
           setIsListening(false);
        };
        
        // Save instance
        recognitionRef.current = recognition;
      }
    }
  }, []); // Run ONCE to set up the instance. Logic inside uses valueRef.

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition not supported in this browser.");
        return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech start error", e);
      }
    }
  };

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
       <textarea
          className={cn(
             "w-full min-h-[120px] p-4 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-lg",
             // Force high contrast: Black text, white background
             "bg-white text-black", 
             // Dark mode override if system is dark but we want high contrast
             "dark:bg-white dark:text-black",
             isListening ? "border-red-400 ring-2 ring-red-100" : "border-gray-200"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
       />
       
       <div className="absolute bottom-3 right-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="default" // Changed to default (usually black/dark) for contrast
            onClick={toggleListening}
            className={cn(
                "rounded-full transition-all text-white", 
                isListening ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-black hover:bg-zinc-800"
            )}
            disabled={disabled}
          >
             {isListening ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
             {isListening ? "Listening..." : "Dictate"}
          </Button>
       </div>
    </div>
  );
}
