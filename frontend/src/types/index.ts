export type GamePhase = "LOBBY" | "ROUND" | "GRADING" | "RESULTS" | "GAME_OVER";

export type GameMode = "BEHAVIOURAL" | "TECHNICAL" | "MIXED";

export interface Player {
  id: string;
  name: string;
  isMe: boolean;
  avatarSeed?: string; // For generating bot faces if we want
  hasSubmitted?: boolean;
  score?: number;
  feedback?: string[];
  cameraEnabled?: boolean;
  lastVideoFrame?: string; // base64 data URI
  x?: number;
  y?: number;
  isMoving?: boolean;
  facingRight?: boolean;
  isLeader?: boolean;
  isChatting?: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  type: "BEHAVIOURAL" | "TECHNICAL" | string; // loose typing for now
  difficulty?: string;
  duration?: number;
}

export interface RoundResult {
  playerId: string;
  score: number;
  feedback: string[];
}
