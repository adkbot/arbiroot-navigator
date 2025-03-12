
import { Button } from "@/components/ui/button";
import { Loader2, Power, Pause, Play, StopCircle, RefreshCw, LogOut } from "lucide-react";

interface BotControlProps {
  toggleBot: () => void;
  pauseBot: () => void;
  restartBot: () => void;
  stopBot: () => void;
  disconnectWallet: () => void;
  botActive: boolean;
  botPaused: boolean;
  isActivating: boolean;
}

const BotControl = ({ 
  toggleBot, 
  pauseBot, 
  restartBot, 
  stopBot, 
  disconnectWallet,
  botActive, 
  botPaused,
  isActivating 
}: BotControlProps) => {
  return (
    <div className="space-y-2">
      {isActivating ? (
        <Button
          variant="default"
          className="w-full"
          disabled
        >
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Activating...
          </span>
        </Button>
      ) : botActive ? (
        <div className="grid grid-cols-2 gap-2">
          {botPaused ? (
            <Button
              variant="default"
              className="w-full"
              onClick={restartBot}
            >
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Resume
              </span>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={pauseBot}
            >
              <span className="flex items-center gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </span>
            </Button>
          )}
          <Button
            variant="destructive"
            className="w-full"
            onClick={stopBot}
          >
            <span className="flex items-center gap-2">
              <StopCircle className="h-4 w-4" />
              Stop
            </span>
          </Button>
        </div>
      ) : (
        <Button
          variant="default"
          className="w-full"
          onClick={toggleBot}
        >
          <span className="flex items-center gap-2">
            <Power className="h-4 w-4" />
            Start Bot
          </span>
        </Button>
      )}
      
      <Button
        variant="outline"
        className="w-full"
        onClick={disconnectWallet}
      >
        <span className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Disconnect Wallet
        </span>
      </Button>
    </div>
  );
};

export default BotControl;
