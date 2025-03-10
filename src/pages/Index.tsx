
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { fetchPrices, exchanges, tradingPairs } from '@/lib/api';
import { findTriangularArbitrageOpportunities } from '@/lib/arbitrage';
import { PriceData, ArbitrageOpportunity } from '@/lib/types';
import Header from '@/components/Header';
import PriceCard from '@/components/PriceCard';
import ArbitrageOpportunityCard from '@/components/ArbitrageOpportunity';
import ExchangeSelector from '@/components/ExchangeSelector';

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(
    exchanges.slice(0, 5).map(exchange => exchange.id)
  );
  const [minProfitPercentage, setMinProfitPercentage] = useState(0.5);
  const [maxPathLength, setMaxPathLength] = useState(3);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(
    tradingPairs.slice(0, 6)
  );
  const [refreshInterval, setRefreshInterval] = useState(15000); // 15 seconds
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Initial load
  useEffect(() => {
    fetchPriceData();
    
    // Auto-refresh timer
    let intervalId: number | undefined;
    
    if (autoRefresh) {
      intervalId = window.setInterval(() => {
        fetchPriceData();
      }, refreshInterval);
    }
    
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [selectedExchanges, refreshInterval, autoRefresh]);
  
  // Recalculate opportunities when prices or settings change
  useEffect(() => {
    calculateArbitrageOpportunities();
  }, [prices, minProfitPercentage, maxPathLength, selectedExchanges]);

  const fetchPriceData = async () => {
    try {
      // Save current prices as previous prices for animation
      const priceMap: Record<string, number> = {};
      prices.forEach(price => {
        const key = `${price.exchange}-${price.symbol}`;
        priceMap[key] = price.price;
      });
      setPreviousPrices(priceMap);
      
      // Fetch new prices
      const newPrices = await fetchPrices();
      setPrices(newPrices);
      
      if (loading) {
        setLoading(false);
        toast({
          title: "Connected to exchanges",
          description: "Successfully fetched price data from exchanges.",
        });
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch price data from exchanges.",
      });
    }
  };
  
  const calculateArbitrageOpportunities = () => {
    if (prices.length === 0) return;
    
    setLoadingOpportunities(true);
    
    try {
      const newOpportunities = findTriangularArbitrageOpportunities(prices, {
        minProfitPercentage,
        maxPathLength,
        includeExchanges: selectedExchanges,
      });
      
      setOpportunities(newOpportunities);
    } catch (error) {
      console.error("Error calculating arbitrage opportunities:", error);
    } finally {
      setLoadingOpportunities(false);
    }
  };
  
  const getPreviousPrice = (exchange: string, symbol: string) => {
    const key = `${exchange}-${symbol}`;
    return previousPrices[key];
  };
  
  const filteredPrices = prices.filter(price => 
    selectedExchanges.includes(price.exchange) && 
    selectedPairs.includes(price.symbol)
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header onTabChange={setActiveTab} activeTab={activeTab} />
      
      <main className="flex-1 pt-24 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <Tabs value={activeTab} className="space-y-6">
          <TabsContent value="dashboard" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xl">Market Overview</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={fetchPriceData}
                      >
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
                        {Array(9).fill(0).map((_, i) => (
                          <div 
                            key={i} 
                            className="h-24 bg-muted rounded-md animate-pulse"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredPrices.map((price, index) => (
                          <div 
                            key={`${price.exchange}-${price.symbol}`}
                            className="animate-scale-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <PriceCard 
                              data={price} 
                              previousPrice={getPreviousPrice(price.exchange, price.symbol)} 
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-1">
                <ExchangeSelector
                  exchanges={exchanges}
                  selectedExchanges={selectedExchanges}
                  onSelectionChange={setSelectedExchanges}
                />
              </div>
            </div>
            
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl">Recent Opportunities</CardTitle>
                  <Badge variant="outline">
                    {opportunities.length} Found
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingOpportunities ? (
                  <div className="space-y-3 animate-pulse">
                    {Array(3).fill(0).map((_, i) => (
                      <div 
                        key={i} 
                        className="h-20 bg-muted rounded-md"
                      />
                    ))}
                  </div>
                ) : opportunities.length > 0 ? (
                  <div className="space-y-3">
                    {opportunities.slice(0, 5).map((opportunity, index) => (
                      <div 
                        key={opportunity.id}
                        className="animate-slide-up"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <ArbitrageOpportunityCard opportunity={opportunity} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No arbitrage opportunities found with current settings</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => setMinProfitPercentage(minProfitPercentage * 0.5)}
                    >
                      Lower Profit Threshold
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="opportunities" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Min. Profit (%)</span>
                        <span className="text-sm font-medium">{minProfitPercentage.toFixed(2)}%</span>
                      </div>
                      <Slider
                        value={[minProfitPercentage]}
                        min={0.01}
                        max={5}
                        step={0.01}
                        onValueChange={(value) => setMinProfitPercentage(value[0])}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Max Path Length</span>
                        <span className="text-sm font-medium">{maxPathLength}</span>
                      </div>
                      <Slider
                        value={[maxPathLength]}
                        min={3}
                        max={5}
                        step={1}
                        onValueChange={(value) => setMaxPathLength(value[0])}
                      />
                    </div>
                    
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Auto-Refresh</span>
                        <Button
                          variant={autoRefresh ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setAutoRefresh(!autoRefresh)}
                        >
                          {autoRefresh ? "On" : "Off"}
                        </Button>
                      </div>
                      {autoRefresh && (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Interval</span>
                            <span className="text-xs text-muted-foreground">
                              {(refreshInterval / 1000).toFixed(0)}s
                            </span>
                          </div>
                          <Slider
                            value={[refreshInterval]}
                            min={5000}
                            max={60000}
                            step={1000}
                            onValueChange={(value) => setRefreshInterval(value[0])}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-3">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">All Opportunities</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary">
                          {opportunities.filter(o => o.type === 'triangular').length} Triangular
                        </Badge>
                        <Badge variant="outline">
                          {opportunities.filter(o => o.type === 'simple').length} Simple
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingOpportunities ? (
                      <div className="space-y-3 animate-pulse">
                        {Array(5).fill(0).map((_, i) => (
                          <div 
                            key={i} 
                            className="h-20 bg-muted rounded-md"
                          />
                        ))}
                      </div>
                    ) : opportunities.length > 0 ? (
                      <div className="space-y-3">
                        {opportunities.map((opportunity, index) => (
                          <div 
                            key={opportunity.id}
                            className="animate-slide-up"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <ArbitrageOpportunityCard opportunity={opportunity} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          No arbitrage opportunities match your current criteria
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4"
                          onClick={calculateArbitrageOpportunities}
                        >
                          Recalculate
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Trading Pairs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {tradingPairs.map(pair => (
                          <Badge
                            key={pair}
                            variant={selectedPairs.includes(pair) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              if (selectedPairs.includes(pair)) {
                                setSelectedPairs(selectedPairs.filter(p => p !== pair));
                              } else {
                                setSelectedPairs([...selectedPairs, pair]);
                              }
                            }}
                          >
                            {pair}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Refresh Interval</span>
                          <span className="text-sm font-medium">
                            {(refreshInterval / 1000).toFixed(0)}s
                          </span>
                        </div>
                        <Slider
                          value={[refreshInterval]}
                          min={5000}
                          max={60000}
                          step={1000}
                          onValueChange={(value) => setRefreshInterval(value[0])}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Auto-Refresh</span>
                        <Button
                          variant={autoRefresh ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAutoRefresh(!autoRefresh)}
                        >
                          {autoRefresh ? "Enabled" : "Disabled"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Exchange Connections</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {exchanges.map(exchange => (
                        <Card key={exchange.id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <div className="h-8 w-8 rounded-full overflow-hidden bg-background flex items-center justify-center">
                                  <img 
                                    src={exchange.logo} 
                                    alt={exchange.name} 
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32';
                                    }}
                                  />
                                </div>
                                <span className="font-medium">{exchange.name}</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                              >
                                Connect
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="py-4 px-6 border-t">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            ArbiRoot Navigator © {new Date().getFullYear()}
          </p>
          <div className="flex items-center space-x-4 mt-2 sm:mt-0">
            <span className="text-xs text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
