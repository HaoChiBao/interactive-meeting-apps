import { create } from "zustand";
import { Player } from "@/types";

interface GameState {
  // Room
  roomCode: string | null;

  // Players
  me: Player | null;
  others: Player[];

  // My State
  recordingBlob: Blob | null;
  recordingUrl: string | null;

  // Actions
  setRoomCode: (code: string) => void;
  setMe: (name: string) => void;
  addOtherPlayer: (player: Player) => void;
  updateOtherPlayer: (id: string, updates: Partial<Player>) => void;
  setRecording: (blob: Blob | null) => void;

  handleServerMessage: (msg: any) => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomCode: null,
  me: null,
  others: [],
  recordingBlob: null,
  recordingUrl: null,

  setRoomCode: (code) => set({ roomCode: code }),
  setMe: (name) => set((prev) => ({
    me: { id: "me", name, isMe: true, cameraEnabled: true } // Default cam on
  })),

  addOtherPlayer: (player) => set((state) => ({
    others: [...state.others, player]
  })),

  updateOtherPlayer: (id, updates) => set((state) => ({
    others: state.others.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  })),

  setRecording: (blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      set((state) => ({
        recordingBlob: blob,
        recordingUrl: url,
      }));
    } else {
      set({ recordingBlob: null, recordingUrl: null });
    }
  },

  handleServerMessage: (msg: any) => {
    set((state) => {
      switch (msg.type) {
        case "welcome":
          return {
            me: state.me ? { ...state.me, name: msg.username, id: msg.id } : null
          };

        case "player_update":
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
