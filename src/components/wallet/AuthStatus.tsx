
import { Shield, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { WalletInfo } from "@/lib/types";

interface AuthStatusProps {
  wallet: WalletInfo;
}

const AuthStatus = ({ wallet }: AuthStatusProps) => {
  const { authorizeSpending, isConnecting } = useWallet();
  
  return (
    <div className="flex justify-between items-center p-2 rounded-md bg-muted/40">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">Status</span>
      </div>
      
      {wallet.isAuthorized ? (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm font-medium">Autorizado</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-amber-500" />
          <Button 
            size="sm" 
            className="h-7 text-xs"
            onClick={authorizeSpending}
            disabled={isConnecting}
          >
            {isConnecting ? "Processando..." : "Autorizar"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuthStatus;
