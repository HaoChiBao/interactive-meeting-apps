import { useGameStore } from "@/store/useGameStore";
import { QUESTIONS } from "./questions";
import { Player } from "@/types";

const BOT_NAMES = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank"];

function generateBots(count: number): Player[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `bot-${i}`,
    name: BOT_NAMES[i % BOT_NAMES.length],
    isMe: false,
    cameraEnabled: false, // Bots don't have cameras
    avatarSeed: `bot-${i}`,
  }));
}

export class FakeServer {
  private static timeouts: NodeJS.Timeout[] = [];

  static joinRoom(code: string, playerName: string) {
    const store = useGameStore.getState();
    store.setRoomCode(code);
    store.setMe(playerName);
    
    // Simulate bots joining
    const bots = generateBots(5);
    bots.forEach(bot => store.addOtherPlayer(bot));
  }

  static startRound() {
    const store = useGameStore.getState();
    
    // Pick random question
    const qIndex = Math.floor(Math.random() * QUESTIONS.length);
    const question = QUESTIONS[qIndex];
    
    store.setRound(question, 60);

    // Simulate bot submissions
    store.others.forEach((bot) => {
      // Bots submit between 30s and 55s
      const delay = 30000 + Math.random() * 25000;
      const t = setTimeout(() => {
        useGameStore.getState().updateOtherPlayer(bot.id, { hasSubmitted: true });
        FakeServer.checkAllSubmitted();
      }, delay);
      this.timeouts.push(t);
    });
  }

  static checkAllSubmitted() {
    const store = useGameStore.getState();
    const allBotsSubmitted = store.others.every(p => p.hasSubmitted);
    const meSubmitted = store.me?.hasSubmitted;

    if (allBotsSubmitted && meSubmitted) {
      this.startGrading();
    }
  }

  static startGrading() {
    const store = useGameStore.getState();
    store.setPhase("GRADING");
    
    // Simulate thinking time
    setTimeout(() => {
      const grades: Record<string, { score: number; feedback: string[] }> = {};
      
      // Grade me
      grades["me"] = {
        score: Math.floor(70 + Math.random() * 30),
        feedback: ["Good eye contact.", "Clear enunciation.", "Could be more structured."],
      };

      // Grade bots
      store.others.forEach(bot => {
        grades[bot.id] = {
          score: Math.floor(60 + Math.random() * 40),
          feedback: ["Solid answer.", "A bit vague."],
        };
      });

      store.setGrades(grades);
    }, 8000);
  }
}
