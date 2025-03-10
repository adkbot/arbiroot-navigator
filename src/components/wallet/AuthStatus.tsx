
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { WalletInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";

interface AuthStatusProps {
  wallet: WalletInfo;
}

const AuthStatus = ({ wallet }: AuthStatusProps) => {
  const { authorizeSpending, isConnecting } = useWallet();
  
  return (
    <div className="pt-2 border-t">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">MetaMask Authorization</span>
        </div>
        {wallet.isAuthorized ? (
          <Badge variant="outline" className="border-green-500 text-green-500">
            Approved
          </Badge>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={authorizeSpending}
            disabled={isConnecting}
          >
            {isConnecting ? "Processing..." : "Authorize with MetaMask"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default AuthStatus;
