"use client";

import React, { useEffect, useRef } from "react";
import { useGameStore } from "@/store/useGameStore";
import { socketClient } from "@/lib/socket";

// Helper to convert Float32 (Web Audio) to Int16 (transport)
function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

// Helper: Int16 -> Float32
function int16ToFloat32(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const int = input[i];
        // If the high bit is set, it's a negative number in 16-bit 2's complement
        // But DataView.getInt16 handles sign. If we have raw array, standard conversion:
        output[i] = (int >= 0x8000) ? -(0x10000 - int) / 0x8000 : int / 0x7FFF;
    }
    return output;
}

// Better One: DataView based decoding from base64 string
function base64ToFloat32(base64: string): Float32Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] < 0 ? int16[i] / 0x8000 : int16[i] / 0x7FFF;
    }
    return float32;
}


interface AudioChatProps {
    visualState: Record<string, { x: number, y: number }>;
    onVolumeChange: (volumes: Record<string, number>) => void;
    privatePeerId?: string | null;
}

export function AudioChat({ visualState, onVolumeChange, privatePeerId }: AudioChatProps) {
    const me = useGameStore(s => s.me);

    // Audio Context Refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Analysis Refs
    const analysersRef = useRef<Record<string, AnalyserNode>>({});
    const animationFrameRef = useRef<number | undefined>(undefined);

    // Private Peer Ref (for access in closures)
    const privatePeerIdRef = useRef<string | null>(null);
    useEffect(() => {
        privatePeerIdRef.current = privatePeerId || null;
    }, [privatePeerId]);

    // Remote Peers State
    // access via refs to avoid closure staleness in message handlers
    const peerNodes = useRef<Record<string, { gain: GainNode, nextTime: number } | undefined>>({});

    // 1. Initialize Audio Context & Capture
    useEffect(() => {
        const initAudio = async () => {
            try {
                // Enhanced constraints for voice quality
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });

                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
                audioCtxRef.current = ctx;

                const source = ctx.createMediaStreamSource(stream);
                sourceRef.current = source;

                // Create Compressor for "Broadcast" Vocal Chain
                const compressor = ctx.createDynamicsCompressor();
                compressor.threshold.value = -20;  // Standard broadcast level
                compressor.knee.value = 10;        // Softer transition
                compressor.ratio.value = 4;        // 4:1 is standard for voice
                compressor.attack.value = 0.002;   // Fast attack to catch peaks
                compressor.release.value = 0.15;   // Natural release

                // Create Analyser for Local User
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.5;
                analysersRef.current["me"] = analyser;

                // Create Processor
                // BufferSize 16384 @ 48kHz = ~341ms.
                // Maximum stability, zero dropouts. High quality, high latency.
                const processor = ctx.createScriptProcessor(16384, 1, 1);
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    if (!socketClient) return;

                    const inputData = e.inputBuffer.getChannelData(0);

                    // Convert to Int16 PCM
                    // Compressor handles gaining, so we just clip safely
                    const buffer = new ArrayBuffer(inputData.length * 2);
                    const view = new DataView(buffer);

                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i])); // Hard clip safe
                        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                    }

                    // Base64 encode
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = window.btoa(binary);

                    const payload: any = { chunk: base64 };
                    if (privatePeerIdRef.current) {
                        payload.to_id = privatePeerIdRef.current;
                    }

                    socketClient.send("audio_update", payload);
                };

                // Connect graph
                source.connect(compressor);
                source.connect(analyser); // Analyze pre-compression or post? Pre is raw dynamic range.
                compressor.connect(processor);
                processor.connect(ctx.destination); // ScriptProcessor needs destination to run

            } catch (err) {
                console.error("Audio capture failed:", err);
            }
        };

        initAudio();

        return () => {
            processorRef.current?.disconnect();
            sourceRef.current?.disconnect();
            audioCtxRef.current?.close();
            // CRITICAL: Clear peer nodes because they belong to the closed context.
            peerNodes.current = {};
            analysersRef.current = {};
        };
    }, []);


    // 2. Handle Incoming Audio
    useEffect(() => {
        const handleAudioMsg = (e: CustomEvent) => {
            const data = e.detail;
            if (data.type !== "audio_update") return;
            if (data.id === me?.id) return; // Ignore self

            // Audio Isolation: If in private chat, ignore everyone except partner
            if (privatePeerIdRef.current && data.id !== privatePeerIdRef.current) {
                return;
            }

            const ctx = audioCtxRef.current;
            if (!ctx || ctx.state === "closed") return;

            // Decode Chunk
            const float32 = base64ToFloat32(data.chunk);

            // Create Buffer
            const buffer = ctx.createBuffer(1, float32.length, 48000);
            buffer.copyToChannel(float32 as any, 0);

            // Get or Create Peer Node
            let peer = peerNodes.current[data.id];

            // Zombie Check: If peer exists but belongs to a different (old) context, kill it.
            if (peer && peer.gain.context !== ctx) {
                peer = undefined;
            }

            if (!peer) {
                const gainParams = ctx.createGain();
                gainParams.connect(ctx.destination);

                // Create Analyser for Peer
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.5;
                gainParams.connect(analyser);
                analysersRef.current[data.id] = analyser;

                peer = { gain: gainParams, nextTime: ctx.currentTime };
                peerNodes.current[data.id] = peer;
            }

            // Create Source
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(peer.gain);

            // Schedule & Jitter Buffer Logic
            const NOW = ctx.currentTime;

            // Lag Compensation: if we ran dry > 50ms ago, reset to NOW (we ran dry).
            if (peer.nextTime < NOW - 0.05) {
                peer.nextTime = NOW;
            }

            // Buffer Bloat Compensation: if we are > 200ms ahead, jump forward.
            // This sacrifices some data to stay real-time.
            if (peer.nextTime > NOW + 0.2) {
                peer.nextTime = NOW;
            }

            const schedTime = peer.nextTime;
            source.start(schedTime);

            // Advance time
            peer.nextTime = schedTime + buffer.duration;
        };

        window.addEventListener("game_socket_message" as any, handleAudioMsg);
        return () => window.removeEventListener("game_socket_message" as any, handleAudioMsg);
    }, [me?.id]);


    // 3. Update Volumes based on Distance & RMS Loop
    useEffect(() => {
        // Distance Logic
        if (visualState && me && audioCtxRef.current) {
            const myPos = visualState[me.id];
            if (myPos) {
                Object.entries(peerNodes.current).forEach(([id, peer]) => {
                    if (!peer) return;
                    const otherPos = visualState[id];
                    if (!otherPos) return;

                    const dist = Math.sqrt(
                        Math.pow(otherPos.x - myPos.x, 2) + Math.pow(otherPos.y - myPos.y, 2)
                    );

                    // Full volume at 0-100px. Linear drop to 0 at 600px.
                    const MAX_DIST = 600;
                    const MIN_DIST = 100;

                    let volume = 1;
                    if (dist > MIN_DIST) {
                        volume = 1 - (dist - MIN_DIST) / (MAX_DIST - MIN_DIST);
                    }
                    volume = Math.max(0, Math.min(1, volume));

                    // Ease value
                    try {
                        if (audioCtxRef.current?.state === 'running') {
                            peer.gain.gain.setTargetAtTime(volume, audioCtxRef.current!.currentTime, 0.1);
                        }
                    } catch (e) {
                        // ignore
                    }
                });
            }
        }

        // RMS Analysis Loop (runs at 10-20 FPS independent of game loop)
        const updateVolumes = () => {
            const volumes: Record<string, number> = {};

            // Process all analysers
            Object.entries(analysersRef.current).forEach(([id, analyser]) => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);

                // Calculate RMS
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    sum += data[i] * data[i];
                }
                const rms = Math.sqrt(sum / data.length);

                // Normalize 0-255 -> 0-1
                // Apply gate: if < 0.05 (noise floor), clamp to 0
                const val = rms / 255;
                volumes[id === "me" && me ? me.id : id] = val < 0.05 ? 0 : val;
            });

            onVolumeChange(volumes);

            animationFrameRef.current = requestAnimationFrame(updateVolumes);
        };

        // Start loop
        animationFrameRef.current = requestAnimationFrame(updateVolumes);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };

    }, [visualState, me, onVolumeChange]);

    return null; // Headless component
}
