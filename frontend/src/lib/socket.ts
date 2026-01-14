import { useGameStore } from "@/store/useGameStore";

// Singleton WebSocket client
class GameSocket {
  private socket: WebSocket | null = null;

  //   private getWebSocketUrl(): string {
  //     console.log("[Socket] Env Check:", {
  //       WS: process.env.NEXT_PUBLIC_WS_URL,
  //       API: process.env.NEXT_PUBLIC_API_URL
  //     });

  //     if (process.env.NEXT_PUBLIC_WS_URL) {
  //       // Ensure it ends with /ws if not present
  //       const url = process.env.NEXT_PUBLIC_WS_URL;
  //       return url.endsWith("/ws") ? url : url + "/ws";
  //     }

  //     // Fallback: derive from API URL
  //     const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  //     const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
  //     const wsUrl = apiUrl.replace(/^https?/, wsProtocol);
  //     return wsUrl + "/ws";
  //   }

  private url: string = 'wss://interview-royale-production.up.railway.app/ws';
  // private url: string = 'ws://localhost:8000/ws';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageQueue: string[] = [];

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    console.log("Connecting to WS...", this.url);
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log("WS Connected");
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.flushQueue();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { debugLogState, handleServerMessage } = useGameStore.getState();

        if (debugLogState) {
          console.log("[WS IN]", data);
        }

        handleServerMessage(data);

        // Dispatch raw event for non-store subscribers (e.g. AudioChat)
        window.dispatchEvent(new CustomEvent("game_socket_message", { detail: data }));
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    this.socket.onclose = () => {
      console.log("WS Closed");
      this.socket = null;
      // Auto reconnect
      this.reconnectTimeout = setTimeout(() => this.connect(), 2000);
    };

    this.socket.onerror = (err) => {
      console.error("WS Error", err);
      // onError will usually be followed by onClose
    };
  }

  private flushQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) this.socket.send(msg);
    }
  }

  send(type: string, payload: any) {
    const msg = { type, ...payload };
    const { debugLogState } = useGameStore.getState();
    if (debugLogState) {
      console.log("[WS OUT]", msg);
    }

    const msgStr = JSON.stringify(msg);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(msgStr);
    } else {
      console.log("WS Not Connected, queuing", type);
      this.messageQueue.push(msgStr);
    }
  }

  join(username: string) {
    const { roomCode } = useGameStore.getState();
    this.send("join", { username, room_code: roomCode });
  }

  startGame() {
    this.send("start_game", {});
  }

  submit(content: string) {
    useGameStore.getState().setSubmitted(true);
    this.send("submit", { content });
  }

  sendVideoFrame(frame: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Bypass debug log for video frames to avoid spam
      this.socket.send(JSON.stringify({ type: "video_update", frame }));
    }
  }

  sendCoffeeInvite(targetId: string) {
    this.send("coffee_invite", { target_id: targetId });
  }

  acceptCoffeeInvite(targetId: string) {
    this.send("coffee_accept", { target_id: targetId });
  }

  leaveCoffeeChat(targetId?: string) {
    this.send("coffee_leave", { target_id: targetId });
  }
}

export const socketClient = new GameSocket();
