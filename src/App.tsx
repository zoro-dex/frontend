import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { ModeToggle } from "@/components/mode-toggle";
import { useWallet } from '@demox-labs/miden-wallet-adapter-react';

type TabType = "Market" | "Limit";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("Market");
  const [sellAmount, setSellAmount] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");
  
  const { connected, connecting } = useWallet();

  const handleSwap = async () => {
    if (!connected) {
      console.log("Wallet not connected");
      return;
    }
    
    // Add swap logic here using the Miden SDK
    console.log("Executing swap:", { sellAmount, buyAmount });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-3 sm:p-4 -mt-20">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6">
          {/* Tab Nav */}
          <div className="flex items-center justify-between">
            <div className="flex bg-muted rounded-full p-0.5 sm:p-1">
              {["Market", "Limit"].map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab as TabType)}
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
                      onChange={(e) => setSellAmount(e.target.value)}
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
                      onChange={(e) => setBuyAmount(e.target.value)}
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

            {/* Swap Button - only show if connected */}
            {connected && (
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
    </div>
  );
}

export default App;