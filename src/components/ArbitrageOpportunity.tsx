
import { useState } from 'react';
import { ArbitrageOpportunity as ArbitrageOpportunityType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface ArbitrageOpportunityProps {
  opportunity: ArbitrageOpportunityType;
}

const ArbitrageOpportunity = ({ opportunity }: ArbitrageOpportunityProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const { profit, profitPercentage, path, details, timestamp, exchanges } = opportunity;
  
  const formattedDate = new Date(timestamp).toLocaleTimeString();
  const formattedProfit = profit.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Calculate time difference to show how recent the opportunity is
  const timeDiffInSeconds = Math.floor((Date.now() - timestamp) / 1000);
  const isRecent = timeDiffInSeconds < 10; // Less than 10 seconds old
  
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-300 card-hover", 
        expanded ? "shadow-md" : "",
        isRecent ? "border-green-500" : ""
      )}
    >
      <CardHeader className="px-4 py-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex gap-2 items-center">
          <CardTitle className="text-base font-medium flex items-center gap-1">
            {profitPercentage.toFixed(2)}% Profit
            {isRecent && <Sparkles className="h-4 w-4 text-green-500 animate-pulse" />}
          </CardTitle>
          <Badge variant="outline">
            Simple
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '−' : '+'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="px-4 pb-4 pt-0">
        <div className="text-sm mb-2">
          <div className="flex flex-wrap gap-1 mb-2">
            {exchanges.map((exchange, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {exchange}
              </Badge>
            ))}
          </div>
          {expanded ? (
            <div className="mt-3 space-y-2 animate-fade-in">
              <p className="text-sm">{details}</p>
              <div className="flex items-center gap-2 mb-3 mt-2">
                <span className="text-xs font-medium">Lucro Estimado:</span>
                <span className="text-green-500 font-semibold">{formattedProfit}</span>
              </div>
              <div className="flex justify-between mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                >
                  Analisar
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="text-xs"
                >
                  Executar Trade
                </Button>
              </div>
            </div>
          ) : (
            <p className="truncate text-sm">{details}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ArbitrageOpportunity;
