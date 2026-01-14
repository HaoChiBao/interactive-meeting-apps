import { create } from "zustand";
import { GamePhase, GameMode, Player, Question } from "@/types";

interface GameState {
  // Room
  roomCode: string | null;
  phase: GamePhase;
  mode: GameMode;

  // Players
  me: Player | null;
  others: Player[];

  // Round
  currentQuestion: Question | null;
  roundEndTime: number | null; // Timestamp
  roundDuration: number;

  // My State
  isReady: boolean;
  recordingBlob: Blob | null;
  recordingUrl: string | null;

  // New Features
  leaderboard: { username: string; score: number }[];
  gameSettings: { num_rounds: number; round_duration: number };

  // Voting & Animation
  intermissionDuration: number;
  intermissionEndTime: number | null;
  votes: Record<string, number>; // username -> rounds
  isChoosingSettings: boolean;
  isStarting: boolean;
  chosenSettings: { num_rounds: number; all_votes: number[] } | null;

  // Actions
  setRoomCode: (code: string) => void;
  setMe: (name: string) => void;
  setPhase: (phase: GamePhase) => void;
  setMode: (mode: GameMode) => void;
  addOtherPlayer: (player: Player) => void;
  updateOtherPlayer: (id: string, updates: Partial<Player>) => void;
  setReady: (ready: boolean) => void;
  setRound: (question: Question, duration: number) => void;
  setRecording: (blob: Blob | null) => void;
  setGrades: (grades: Record<string, { score: number; feedback: string[] }>) => void;
  resetRound: () => void;
  setSubmitted: (submitted: boolean) => void;
  setHasSubmitted: () => void;

  setGameSettings: (settings: { num_rounds: number; round_duration: number }) => void;

  debugLogState: boolean;
  toggleDebugLogState: () => void;
  handleServerMessage: (msg: any) => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomCode: null,
  phase: "LOBBY",
  mode: "BEHAVIOURAL",
  me: null,
  others: [],
  currentQuestion: null,
  roundEndTime: null,
  roundDuration: 60,
  isReady: false,
  recordingBlob: null,
  recordingUrl: null,

  leaderboard: [],
  gameSettings: { num_rounds: 3, round_duration: 60 },
  intermissionDuration: 10,
  intermissionEndTime: null,
  votes: {},
  isChoosingSettings: false,
  isStarting: false,
  chosenSettings: null,

  debugLogState: false,
  toggleDebugLogState: () => set((state) => ({ debugLogState: !state.debugLogState })),

  setRoomCode: (code) => set({ roomCode: code }),
  setMe: (name) => set((prev) => ({
    me: { id: "me", name, isMe: true, cameraEnabled: true } // Default cam on
  })),
  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),

  addOtherPlayer: (player) => set((state) => ({
    others: [...state.others, player]
  })),

  updateOtherPlayer: (id, updates) => set((state) => ({
    others: state.others.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  })),

  setReady: (ready) => set({ isReady: ready }),

  setRound: (question, duration) => set((state) => ({
    currentQuestion: question,
    roundDuration: duration,
    roundEndTime: Date.now() + duration * 1000,
    phase: "ROUND",
    recordingBlob: null,
    recordingUrl: null,
    me: state.me ? { ...state.me, hasSubmitted: false } : null,
    others: state.others.map(p => ({ ...p, hasSubmitted: false }))
  })),

  setRecording: (blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      set((state) => ({
        recordingBlob: blob,
        recordingUrl: url,
        me: state.me ? { ...state.me, hasSubmitted: true } : null
      }));
    } else {
      set({ recordingBlob: null, recordingUrl: null });
    }
  },

  setGrades: (grades) => { /* Helper for local updates if needed */ },

  setGameSettings: (settings) => set({ gameSettings: settings }),

  resetRound: () => set((state) => ({
    currentQuestion: null,
    roundEndTime: null,
    recordingBlob: null,
    recordingUrl: null,
  })),

  setSubmitted: (submitted) => set((state) => ({
    me: state.me ? { ...state.me, hasSubmitted: submitted } : null
  })),

  // Helper for optimistic optimistic updates
  setHasSubmitted: () => set((state) => ({ 
      me: state.me ? { ...state.me, hasSubmitted: true } : null 
  })),

  handleServerMessage: (msg: any) => {
    set((state) => {
      switch (msg.type) {
        case "welcome":
          return {
            me: state.me ? { ...state.me, name: msg.username, id: msg.id } : null
          };

        case "player_update":
          // msg.players is a list of {id, username, is_leader}.
          // const incomingIds = new Set(msg.players.map((p: any) => p.id));

          const mergedOthers = msg.players
            .filter((p: any) => p.id !== state.me?.id)
            .map((p: any) => {
              const existing = state.others.find(current => current.id === p.id);
              return {
                id: p.id,
                name: p.username,
                isMe: false,
                isLeader: p.is_leader,
                // Preserve existing state
                lastVideoFrame: existing?.lastVideoFrame,
                cameraEnabled: existing?.cameraEnabled,
                hasSubmitted: existing?.hasSubmitted,
                score: existing?.score,
                ...p
              };
            });

          let myUpdates = {};
          if (state.me) {
            const myEntry = msg.players.find((p: any) => p.id === state.me?.id);
            if (myEntry) {
              myUpdates = { isLeader: myEntry.is_leader };
            }
          }

          return {
            others: mergedOthers,
            me: state.me ? { ...state.me, ...myUpdates } : state.me
          };

        case "settings_update":
          return {
            gameSettings: msg.settings,
            votes: msg.votes
          };

        case "game_starting":
          return {
            isStarting: true,
            isChoosingSettings: false
          };

        case "new_question":
          return {
            phase: "ROUND",
            isStarting: false,
            isChoosingSettings: false,
            currentQuestion: msg.question,
            roundDuration: state.gameSettings.round_duration,
            roundEndTime: Date.now() + state.gameSettings.round_duration * 1000,
            recordingBlob: null,
            recordingUrl: null,
            // Reset hasSubmitted for everyone
            me: state.me ? { ...state.me, hasSubmitted: false } : null,
            others: state.others.map(p => ({ ...p, hasSubmitted: false }))
          };

        case "grading_complete":
          // msg.result = {score, feedback}
          if (state.me) {
            return {
              me: { ...state.me, score: msg.result.score, feedback: msg.result.feedback, hasSubmitted: true }
            };
          }
          return {};

        case "round_over":
          // msg.results = [ {id, username, score, feedback, content} ] sorted
          const leaderboard = msg.leaderboard || [];

          // Update others/me from this authoritative list
          const updatedOthers = state.others.map(p => {
            const entry = leaderboard.find((l: any) => l.user_id === p.id);
            return entry ? { ...p, score: entry.score, hasSubmitted: true } : { ...p, hasSubmitted: true };
          });

          const myEntry = leaderboard.find((l: any) => l.user_id === state.me?.id);
          const updatedMe = state.me ? { ...state.me, hasSubmitted: true } : state.me;
          if (state.me && myEntry) {
            updatedMe!.score = myEntry.score;
          }

          return {
            phase: "RESULTS",
            others: updatedOthers,
            me: updatedMe,
            leaderboard,
            intermissionEndTime: msg.intermission_end_time ? msg.intermission_end_time * 1000 : Date.now() + 120000
          };

        case "game_over":
          return {
            phase: "GAME_OVER",
            leaderboard: msg.leaderboard
          };

        case "video_update":
          // { type: "video_update", id, username, frame }
          if (msg.id === state.me?.id) return {}; // Ignore own

          return {
            others: state.others.map(p =>
              p.id === msg.id
                ? { ...p, lastVideoFrame: msg.frame }
                : p
            )
          };

        case "world_update":
          // { type: "world_update", players: { user_id: {x, y} } }
          const positions = msg.players;

          // Update Me
          let newMe = state.me;
          if (state.me && positions[state.me.id]) {
            const myPos = positions[state.me.id];
            newMe = {
              ...state.me,
              x: myPos.x,
              y: myPos.y,
              isMoving: myPos.is_moving,
              facingRight: myPos.facing_right,
              isChatting: myPos.is_chatting
            };
          }

          // Update Others
          const newOthers = state.others.map(p => {
            const pos = positions[p.id];
            if (pos) {
              return {
                ...p,
                x: pos.x,
                y: pos.y,
                isMoving: pos.is_moving,
                facingRight: pos.facing_right,
                isChatting: pos.is_chatting
              };
            }
            return p;
          });

          return {
            me: newMe,
            others: newOthers
          };

        default:
          return {};
      }
    });
  }
}));
