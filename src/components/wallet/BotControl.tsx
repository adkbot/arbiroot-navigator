
import { Button } from "@/components/ui/button";
import { Loader2, Power } from "lucide-react";

interface BotControlProps {
  toggleBot: () => void;
  botActive: boolean;
  isActivating: boolean;
}

const BotControl = ({ toggleBot, botActive, isActivating }: BotControlProps) => {
  return (
    <Button
      variant={botActive ? "outline" : "default"}
      className="w-full"
      onClick={toggleBot}
      disabled={isActivating}
    >
      {isActivating ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Activating...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Power className="h-4 w-4" />
          {botActive ? "Stop Bot" : "Start Bot"}
        </span>
      )}
    </Button>
  );
};

export default BotControl;
