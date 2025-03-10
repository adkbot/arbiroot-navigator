
import { useState } from 'react';
import { ArbitrageOpportunity as ArbitrageOpportunityType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

interface ArbitrageOpportunityProps {
  opportunity: ArbitrageOpportunityType;
}

const ArbitrageOpportunity = ({ opportunity }: ArbitrageOpportunityProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const { type, profit, profitPercentage, path, details, timestamp, exchanges } = opportunity;
  
  const formattedDate = new Date(timestamp).toLocaleTimeString();
  
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-300 card-hover", 
        expanded ? "shadow-md" : ""
      )}
    >
      <CardHeader className="px-4 py-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex gap-2 items-center">
          <CardTitle className="text-base font-medium">
            {profitPercentage.toFixed(2)}% Profit
          </CardTitle>
          <Badge variant={type === 'triangular' ? 'default' : 'outline'}>
            {type === 'triangular' ? 'Triangular' : 'Simple'}
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
              {type === 'triangular' && (
                <div className="bg-muted/50 p-2 rounded-md text-xs">
                  <span className="font-medium">Path: </span>
                  {path.join(' → ')}
                </div>
              )}
              <div className="flex justify-between mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                >
                  Analyze
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="text-xs"
                >
                  Execute Trade
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
