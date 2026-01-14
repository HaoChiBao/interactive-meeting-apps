"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TitleImage from "@/assets/title.png";
import CreateRoomImage from "@/assets/createroom1.png";
import JoinFriendImage from "@/assets/joinfriend.png";
import SoloQueueImage from "@/assets/soloqueue1.png";

export default function Home() {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [soloName, setSoloName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
      const timer = setTimeout(() => {
          setShowContent(true);
      }, 2000);
      return () => clearTimeout(timer);
  }, []);

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

  const handleSolo = () => {
      if (!soloName.trim()) return;
      // Solo queue logic: For now, acts like creating a private room
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem("interview-royale-name", soloName);
      router.push(`/preflight?code=${code}&create=true`);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-12 bg-white text-zinc-900 overflow-hidden font-sans">
      
      {/* Intro Banner */}
      <div 
        className={`absolute z-20 flex flex-col items-center transition-all duration-1000 ease-in-out
          ${showContent 
            ? 'top-4 left-0 right-0 h-32 justify-start' 
            : 'inset-0 justify-center'
          }`}
      >
          <div className={`relative transition-all duration-1000 ${showContent ? 'w-64 md:w-80' : 'w-[80vw]'} px-4`}>
              <Image 
                src={TitleImage} 
                alt="Interview Royale" 
                priority
                className="w-full h-auto object-contain"
              />
          </div>
          <p 
            className={`mt-8 text-3xl md:text-5xl font-normal text-center max-w-[80vw] mx-auto tracking-tight leading-none transition-all duration-500
              ${showContent ? 'opacity-0 h-0 overflow-hidden mt-0' : 'opacity-100 mt-8'}
            `}
            style={{ 
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              letterSpacing: "-3.48px"
            }}
          >
             Battle against your peers for your next j*b
          </p>
      </div>

      {/* Main Content (3 Cards) */}
      <div className={`w-full max-w-7xl transition-all duration-1000 ease-out transform z-10 
        ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}
      `}>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center pt-30 pb-20 px-4 max-w-[1600px] mx-auto">
            
            {/* 1. Create a Room (Orange) - Tilted Left */}
            <div className="relative group perspective-1000 transform -rotate-3 md:-rotate-6 -translate-y-15 hover:z-20 hover:scale-105 transition-all duration-300">
                <div className="flex flex-col h-full bg-white border-4 border-[#FF8B66] rounded-sm pt-3 px-8 pb-12 shadow-[0_10px_30px_-10px_rgba(255,139,102,0.4)] overflow-hidden">
                     <div className="relative w-full aspect-square mb-5">
                        <Image src={CreateRoomImage} alt="Create Room" fill className="object-contain transform " />
                     </div>
                     <h2 className="text-6xl font-semibold text-[#D65F3B] mb-4 tracking-tight leading-none"
                     style={{ 
                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        letterSpacing: "-3.00px", lineHeight: "0.9"
                     }}
                     >Create a Room</h2>
                     
                     <div className="mt-auto space-y-3">
                         <div>
                             <label className="block text-[#D65F3B] font-semibold text-lg mb-1 ml-1"
                              style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                              }}>
                              
                              Display Name</label>
                             <div className="bg-[#FFE5DE] p-1 rounded-sm">
                                  <input 
                                     className="w-full bg-transparent border-none outline-none text-xl p-2 font-bold text-[#D65F3B] placeholder-[#D65F3B]/50"
                                     placeholder=""
                                     style={{ 
                                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                        letterSpacing: "-.50px", lineHeight: "1.00"
                                     }}
                                     value={createName}
                                     onChange={e => setCreateName(e.target.value)}
                                  />
                             </div>
                         </div>
                         <button 
                            onClick={handleCreate}
                            disabled={!createName.trim()}
                            className="w-[200px] mx-auto py-3 justify-center items-center flex rounded-md border-2 border-[#FF8B66] text-[#D65F3B] font-bold text-xl hover:bg-[#FF8B66] hover:text-white transition-all shadow-[0_0_10px_rgba(255,139,102,0.5)] hover:shadow-[0_0_30px_rgba(255,139,102,0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                         >
                             Create
                         </button>
                     </div>
                </div>
            </div>

            {/* 2. Join a Friend (Green) - Center / Straight */}
            <div className="relative group perspective-1000 z-10 hover:scale-105 -translate-y-7 transition-all duration-300">
                 <div className="flex flex-col h-full bg-white border-4 border-[#6BCB77] rounded-sm pt-3 px-8 pb-12 shadow-[0_10px_30px_-5px_rgba(107,203,119,0.4)] overflow-hidden">
                     <div className="relative w-full aspect-square mb-2">
                        <Image src={JoinFriendImage} alt="Join Friend" fill className="object-contain transform scale-110" />
                     </div>
                     <h2 className="text-6xl font-semibold text-[#4CAF50] mb-4 tracking-tight leading-none"
                        style={{ 
                            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                            letterSpacing: "-3.00px", lineHeight: "0.9"
                        }}
                     >Join a Friend</h2>
                     
                     <div className="mt-auto space-y-3">
                         <div>
                             <label className="block text-[#4CAF50] font-semibold text-lg mb-1 ml-1"
                                  style={{ 
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-.50px", lineHeight: "1.00"
                                }}
                             >Display Name</label>
                             <div className="bg-[#E8F5E9] p-1 rounded-sm">
                                 <input 
                                    className="w-full bg-transparent border-none outline-none text-xl p-2 font-bold text-[#4CAF50] placeholder-[#4CAF50]/50"
                                    style={{ 
                                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                        letterSpacing: "-.50px", lineHeight: "1.00"
                                    }}
                                    placeholder=""
                                    value={joinName}
                                    onChange={e => setJoinName(e.target.value)}
                                 />
                             </div>
                         </div>
                         <div>
                             <label className="block text-[#4CAF50] font-semibold text-lg mb-1 ml-1"
                                style={{ 
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-.50px", lineHeight: "1.00"
                                }}
                             >Room Code</label>
                             <div className="border-2 border-[#6BCB77] p-1 rounded-sm">
                                 <input 
                                    className="w-full bg-transparent border-none outline-none text-xl p-2 font-bold text-[#4CAF50] placeholder-[#4CAF50]/50 uppercase tracking-widest font-mono"
                                    placeholder="AXBDWE"
                                    maxLength={6}
                                    value={roomCode}
                                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                                    style={{ 
                                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                        letterSpacing: "-.50px", lineHeight: "1.00"
                                    }}
                                 />
                             </div>
                         </div>
                         <button 
                            onClick={handleJoin}
                            disabled={!joinName.trim() || !roomCode.trim()}
                            className="w-[200px] mx-auto py-3 justify-center items-center flex rounded-md border-2 border-[#6BCB77] text-[#4CAF50] font-bold text-xl hover:bg-[#6BCB77] hover:text-white transition-all shadow-[0_0_10px_rgba(107,203,119,0.5)] hover:shadow-[0_0_30px_rgba(107,203,119,0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                         >
                             Enter
                         </button>
                     </div>
                </div>
            </div>

            {/* 3. Solo Queue (Blue) - Tilted Right */}
            <div className="relative group perspective-1000 transform rotate-3 md:rotate-6 -translate-y-10 hover:z-20 hover:scale-105 transition-all duration-300">
                <div className="flex flex-col h-full bg-white border-4 border-[#4D96FF] rounded-sm pt-3 px-8 pb-12 shadow-[0_10px_30px_-5px_rgba(77,150,255,0.4)] overflow-hidden">
                     <div className="relative w-full aspect-square mb-2">
                        <Image src={SoloQueueImage} alt="Solo Queue" fill className="object-contain transform scale-110" />
                     </div>
                     <h2 className="text-6xl font-semibold text-[#2196F3] mb-4 tracking-tight leading-none"
                         style={{ 
                            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                            letterSpacing: "-3.00px", lineHeight: "0.9"
                        }}
                     >Solo Queue</h2>
                     
                     <div className="mt-auto space-y-3">
                         <div>
                             <label className="block text-[#2196F3] font-semibold text-lg mb-1 ml-1"
                                style={{ 
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-.50px", lineHeight: "1.00"
                                }}
                             >Display Name</label>
                             <div className="bg-[#E3F2FD] p-1 rounded-sm">
                                 <input 
                                    className="w-full bg-transparent border-none outline-none text-xl p-2 font-bold text-[#2196F3] placeholder-[#2196F3]/50"
                                    placeholder=""
                                    value={soloName}
                                    onChange={e => setSoloName(e.target.value)}
                                    style={{ 
                                        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                        letterSpacing: "-.50px", lineHeight: "1.00"
                                    }}
                                 /> 
                             </div>
                         </div>

                         <div className="bg-blue-50/50 p-2 rounded text-xs font-medium text-[#2196F3] leading-tight">
                            <span className="bg-[#2196F3] text-white px-1 rounded text-[10px] mr-1 uppercase"
                                style={{ 
                                    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                    letterSpacing: "-.50px", lineHeight: "1.00"
                                }}
                            >warning</span>
                            might lose against your future co-workers and opponents..?!
                         </div>

                         <button 
                            onClick={handleSolo}  
                            disabled={!soloName.trim()}
                            className="w-[200px] mx-auto py-3 justify-center items-center flex rounded-md border-2 border-[#4D96FF] text-[#2196F3] font-bold text-xl hover:bg-[#4D96FF] hover:text-white transition-all shadow-[0_0_10px_rgba(77,150,255,0.5)] hover:shadow-[0_0_30px_rgba(77,150,255,0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ 
                                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                                letterSpacing: "-.50px", lineHeight: "1.00"
                            }}
                         >
                             Join
                         </button>
                     </div>
                </div>
            </div>

          </div>
      </div>
    </main>
  );
}
