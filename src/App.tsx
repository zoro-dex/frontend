import { useState } from "react";
import { ArrowUpDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/mode-toggle";
import { useWallet } from '@demox-labs/miden-wallet-adapter-react';
import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter-reactui';

type TabType = "Market" | "Limit";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("Market");
  const [sellAmount, setSellAmount] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");
  
  const { connected, connecting, publicKey } = useWallet();

  const tabs: TabType[] = ["Market", "Limit"];

  const handleTabChange = (tab: TabType): void => {
    setActiveTab(tab);
  };

  const handleSellAmountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSellAmount(e.target.value);
  };

  const handleBuyAmountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setBuyAmount(e.target.value);
  };

  const handleSwap = async () => {
    if (!connected) {
      console.log("Wallet not connected");
      return;
    }
    
    // Add your swap logic here using the Miden SDK
    console.log("Executing swap:", { sellAmount, buyAmount });
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Header Tabs */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex bg-muted rounded-full p-0.5 sm:p-1">
            {tabs.map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleTabChange(tab)}
                className={`rounded-full text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 ${
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </Button>
            ))}
          </div>
          <ModeToggle />
        </div>

        {/* Wallet Status */}
        {connected && publicKey && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <Wallet className="w-4 h-4" />
              <span>Connected: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}</span>
            </div>
          </div>
        )}

        {/* Swap Interface */}
        <Card className="border rounded-xl sm:rounded-2xl">
          <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Sell Section */}
            <div className="space-y-2">
              <div className="text-xs sm:text-sm text-muted-foreground">Sell</div>
              <Card className="bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none">
                <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      type="number"
                      value={sellAmount}
                      onChange={handleSellAmountChange}
                      placeholder="0"
                      className="border-none text-2xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner"
                    />
                    <Button 
                      variant="outline"
                      className="rounded-full flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
                    >
                      <span className="font-medium">USDC</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Swap Arrow */}
            <div className="flex justify-center -my-1">
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted border">
                <ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>

            {/* Buy Section */}
            <div className="space-y-2">
              <div className="text-xs sm:text-sm text-muted-foreground">Buy</div>
              <Card className="bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none">
                <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      type="number"
                      value={buyAmount}
                      onChange={handleBuyAmountChange}
                      placeholder="0"
                      className="border-none text-2xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner"
                    />
                    <Button 
                      variant="outline"
                      className="rounded-full px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
                    >
                      MIDEN
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Connect Wallet Button */}
            {!connected ? (
              <WalletMultiButton className="!w-full !py-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-lg !mt-4 sm:!mt-6 !bg-transparent !border-none !text-muted-foreground hover:!text-foreground">
                Connect wallet
              </WalletMultiButton>
            ) : (
              <Button 
                onClick={handleSwap}
                disabled={!sellAmount || !buyAmount || connecting}
                variant="ghost"
                className="w-full py-3 sm:py-4 rounded-xl font-medium text-sm sm:text-lg mt-4 sm:mt-6"
              >
                {connecting ? "Connecting..." : "Swap"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default App;