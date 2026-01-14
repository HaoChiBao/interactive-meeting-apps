import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";

export function DebugLogButton() {
  const debugLogState = useGameStore((s) => s.debugLogState);
  const toggle = useGameStore((s) => s.toggleDebugLogState);

  return (
    <Button 
      variant={debugLogState ? "destructive" : "outline"} 
      size="sm"
      className="fixed top-4 right-4 z-50 text-xs"
      onClick={toggle}
    >
      DEBUG LOG: {debugLogState ? "ON" : "OFF"}
    </Button>
  );
}
