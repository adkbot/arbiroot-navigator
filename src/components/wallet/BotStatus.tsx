
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; 
import { Loader2, TrendingUp, PauseCircle, Activity, BarChart3, CheckCircle2, Clock, PlayCircle, StopCircle } from "lucide-react";

interface BotStatusProps {
  botStatus: 'idle' | 'scanning' | 'trading' | 'waiting' | 'paused';
  totalArbitrages: number;
  lastScanTime?: number | null;
  onStartBot?: () => void;
  onStopBot?: () => void;
  onPauseBot?: () => void;
  onResumeBot?: () => void;
  isActivating?: boolean;
}

const BotStatus = ({ 
  botStatus, 
  totalArbitrages, 
  lastScanTime, 
  onStartBot,
  onStopBot,
  onPauseBot,
  onResumeBot,
  isActivating = false
}: BotStatusProps) => {
  // Calculate time since last scan
  const getTimeSinceLastScan = () => {
    if (!lastScanTime) return null;
    
    const secondsAgo = Math.floor((Date.now() - lastScanTime) / 1000);
    
    if (secondsAgo < 60) {
      return `${secondsAgo}s atrás`;
    } else if (secondsAgo < 3600) {
      return `${Math.floor(secondsAgo / 60)}min atrás`;
    } else {
      return `${Math.floor(secondsAgo / 3600)}h atrás`;
    }
  };
  
  const lastScanTimeText = getTimeSinceLastScan();
  
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
      
      {lastScanTimeText && botStatus !== 'idle' && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Último Scan</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {lastScanTimeText}
          </span>
        </div>
      )}
      
      {/* Bot control buttons */}
      <div className="pt-2 flex flex-wrap gap-2 mt-2">
        {botStatus === 'idle' && (
          <Button 
            size="sm" 
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={onStartBot}
            disabled={isActivating}
          >
            {isActivating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inicializando...</>
            ) : (
              <><PlayCircle className="h-4 w-4 mr-2" /> Iniciar Bot</>
            )}
          </Button>
        )}
        
        {botStatus !== 'idle' && !botStatus.includes('paused') && (
          <Button 
            size="sm" 
            variant="outline"
            className="flex-1"
            onClick={onPauseBot}
          >
            <PauseCircle className="h-4 w-4 mr-1" />
            Pausar
          </Button>
        )}
        
        {botStatus === 'paused' && (
          <Button 
            size="sm" 
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={onResumeBot}
          >
            <PlayCircle className="h-4 w-4 mr-1" />
            Continuar
          </Button>
        )}
        
        {botStatus !== 'idle' && (
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={onStopBot}
          >
            <StopCircle className="h-4 w-4 mr-1" />
            Parar
          </Button>
        )}
      </div>
    </div>
  );
};

export default BotStatus;
