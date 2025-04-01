
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, PauseCircle, Activity, BarChart3, CheckCircle2 } from "lucide-react";

interface BotStatusProps {
  botStatus: 'idle' | 'scanning' | 'trading' | 'waiting' | 'paused';
  totalArbitrages: number;
}

const BotStatus = ({ botStatus, totalArbitrages }: BotStatusProps) => {
  return (
    <div className="pt-2 border-t space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Status do Bot</span>
        </div>
        <Badge variant="outline" className="capitalize">
          {botStatus === 'scanning' && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Escaneando Mercados
            </span>
          )}
          {botStatus === 'trading' && (
            <span className="flex items-center gap-1 text-green-500">
              <TrendingUp className="h-3 w-3" />
              Executando Trade
            </span>
          )}
          {botStatus === 'waiting' && (
            <span className="flex items-center gap-1 text-blue-500">
              <BarChart3 className="h-3 w-3" />
              Aguardando Oportunidade
            </span>
          )}
          {botStatus === 'idle' && "Inativo"}
          {botStatus === 'paused' && (
            <span className="flex items-center gap-1 text-amber-500">
              <PauseCircle className="h-3 w-3" />
              Pausado
            </span>
          )}
        </Badge>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Total de Arbitragens</span>
        </div>
        <Badge variant={totalArbitrages > 0 ? "default" : "outline"} className={totalArbitrages > 0 ? "bg-green-500" : ""}>
          {totalArbitrages}
        </Badge>
      </div>
    </div>
  );
};

export default BotStatus;
