
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp } from "lucide-react";

interface BotStatusProps {
  botStatus: 'idle' | 'scanning' | 'trading' | 'waiting';
}

const BotStatus = ({ botStatus }: BotStatusProps) => {
  return (
    <div className="pt-2 border-t">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm">Bot Status</span>
        </div>
        <Badge variant="outline" className="capitalize">
          {botStatus === 'scanning' && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scanning
            </span>
          )}
          {botStatus === 'trading' && (
            <span className="flex items-center gap-1 text-green-500">
              <TrendingUp className="h-3 w-3" />
              Trading
            </span>
          )}
          {botStatus === 'waiting' && "Waiting"}
          {botStatus === 'idle' && "Idle"}
        </Badge>
      </div>
    </div>
  );
};

export default BotStatus;
