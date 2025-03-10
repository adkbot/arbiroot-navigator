
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { PriceData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PriceCardProps {
  data: PriceData;
  previousPrice?: number;
}

const PriceCard = ({ data, previousPrice }: PriceCardProps) => {
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);
  const [animate, setAnimate] = useState(false);
  
  useEffect(() => {
    if (previousPrice && previousPrice !== data.price) {
      setPriceDirection(data.price > previousPrice ? 'up' : 'down');
      setAnimate(true);
      
      const timer = setTimeout(() => {
        setAnimate(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [data.price, previousPrice]);

  return (
    <Card className="overflow-hidden card-hover">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-muted-foreground">{data.symbol}</span>
          <span className="text-xs text-muted-foreground">{data.exchange}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span 
            className={cn(
              "text-lg font-semibold transition-colors",
              animate && priceDirection === 'up' && "text-green-500",
              animate && priceDirection === 'down' && "text-red-500"
            )}
          >
            {typeof data.price === 'number' && data.price < 0.01
              ? data.price.toFixed(8)
              : typeof data.price === 'number' && data.price < 1
                ? data.price.toFixed(6)
                : typeof data.price === 'number' && data.price < 1000
                  ? data.price.toFixed(4)
                  : typeof data.price === 'number'
                    ? data.price.toFixed(2)
                    : data.price
            }
          </span>
          
          {priceDirection && (
            <span 
              className={cn(
                "ml-2 transition-opacity duration-1000",
                priceDirection === 'up' ? "text-green-500" : "text-red-500",
                animate ? "opacity-100" : "opacity-0"
              )}
            >
              {priceDirection === 'up' ? '↑' : '↓'}
            </span>
          )}
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default PriceCard;
