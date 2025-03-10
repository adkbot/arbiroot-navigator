
import { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExchangeInfo } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ExchangeSelectorProps {
  exchanges: ExchangeInfo[];
  selectedExchanges: string[];
  onSelectionChange: (exchangeIds: string[]) => void;
}

const ExchangeSelector = ({ 
  exchanges,
  selectedExchanges,
  onSelectionChange
}: ExchangeSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleExchanges, setVisibleExchanges] = useState(exchanges);
  
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setVisibleExchanges(exchanges);
    } else {
      const filtered = exchanges.filter(exchange => 
        exchange.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setVisibleExchanges(filtered);
    }
  }, [searchTerm, exchanges]);

  const handleToggle = (exchangeId: string) => {
    const newSelection = [...selectedExchanges];
    
    if (newSelection.includes(exchangeId)) {
      // Remove if already selected
      onSelectionChange(newSelection.filter(id => id !== exchangeId));
    } else {
      // Add if not selected
      onSelectionChange([...newSelection, exchangeId]);
    }
  };
  
  const handleSelectAll = () => {
    if (selectedExchanges.length === exchanges.length) {
      // Deselect all
      onSelectionChange([]);
    } else {
      // Select all
      onSelectionChange(exchanges.map(exchange => exchange.id));
    }
  };

  return (
    <div className="p-4 bg-card rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Exchanges</h3>
        <button 
          className="text-xs text-primary hover:underline"
          onClick={handleSelectAll}
        >
          {selectedExchanges.length === exchanges.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Search exchanges..."
          className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <ScrollArea className="h-64 pr-3">
        <div className="space-y-2">
          {visibleExchanges.map((exchange) => (
            <div 
              key={exchange.id}
              className={cn(
                "flex items-center space-x-3 p-2 rounded-md transition-colors",
                selectedExchanges.includes(exchange.id) ? "bg-muted/50" : "hover:bg-muted/30"
              )}
            >
              <Checkbox
                id={`exchange-${exchange.id}`}
                checked={selectedExchanges.includes(exchange.id)}
                onCheckedChange={() => handleToggle(exchange.id)}
              />
              <div className="flex items-center space-x-2 flex-1">
                <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                  <img 
                    src={exchange.logo} 
                    alt={exchange.name} 
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/20';
                    }}
                  />
                </div>
                <Label 
                  htmlFor={`exchange-${exchange.id}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {exchange.name}
                </Label>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExchangeSelector;
