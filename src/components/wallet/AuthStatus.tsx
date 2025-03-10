
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { WalletInfo } from "@/lib/types";

interface AuthStatusProps {
  wallet: WalletInfo;
}

const AuthStatus = ({ wallet }: AuthStatusProps) => {
  return (
    <div className="pt-2 border-t">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Authorization</span>
        </div>
        <Badge variant={wallet.isAuthorized ? "outline" : "destructive"} className={wallet.isAuthorized ? "border-green-500 text-green-500" : ""}>
          {wallet.isAuthorized ? "Approved" : "Required"}
        </Badge>
      </div>
    </div>
  );
};

export default AuthStatus;
