
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

const Header = ({ onTabChange, activeTab }: HeaderProps) => {
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 py-4 px-6 transition-all duration-300",
        scrolled ? "bg-white/80 shadow-sm backdrop-blur-md" : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-semibold">A</span>
          </div>
          <h1 className="text-xl font-semibold">ArbiRoot</h1>
        </div>
        
        <Tabs defaultValue={activeTab} onValueChange={onTabChange} className="h-10">
          <TabsList className="bg-muted/50 backdrop-blur-sm">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="opportunities"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              Opportunities
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              Settings
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Button variant="outline" size="sm" className="hidden sm:flex">
          Connect Wallet
        </Button>
      </div>
    </header>
  );
};

export default Header;
