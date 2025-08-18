import { useState, useEffect, useContext, useRef } from "react";
import { ArrowUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { ModeToggle } from "@/components/ModeToggle";
import { useWallet } from "@demox-labs/miden-wallet-adapter-react";
import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter-reactui';
import { useNablaAntennaPrices, NablaAntennaContext } from '../components/PriceFetcher';
import { compileZoroSwapNote } from '../lib/ZoroSwapNote.ts';
import { Link } from 'react-router-dom';
import { useBalance } from '../hooks/useBalance';
import { AccountId } from '@demox-labs/miden-sdk';

type TabType = "Swap" | "Limit";

const TOKENS = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    priceId: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
  },
  ETH: {
    symbol: 'ETH', 
    name: 'Ethereum',
    priceId: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
  }
} as const;

interface PriceFetcherProps {
  shouldFetch: boolean;
  assetIds: string[];
}

const PriceFetcher: React.FC<PriceFetcherProps> = ({ shouldFetch, assetIds }) => {
  const { refreshPrices } = useContext(NablaAntennaContext);
  
  useEffect(() => {
    if (!shouldFetch) return;
    refreshPrices(assetIds);
  }, [shouldFetch, refreshPrices, assetIds]);
  
  return null;
};

/**
 * Calculate and format USD value for a token amount
 */
const calculateUsdValue = (amount: string, priceUsd: number): string => {
  const amountNum: number = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0 || !priceUsd) {
    return "";
  }
  
  const usdValue: number = amountNum * priceUsd;

  return usdValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Format token amount with appropriate decimal places
 */
const formatTokenAmount = (amount: string, symbol: string): string => {
  const amountNum: number = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return "";
  }
  
  // Display more decimals for smaller amounts
  const decimals: number = amountNum < 1 ? 8 : amountNum < 100 ? 6 : 4;
  
  return `${amountNum.toFixed(decimals)} ${symbol}`;
};

function Swap() {
  const [activeTab, setActiveTab] = useState<TabType>("Swap");
  const [sellAmount, setSellAmount] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [sellToken, setSellToken] = useState<keyof typeof TOKENS>("BTC");
  const [buyToken, setBuyToken] = useState<keyof typeof TOKENS>("ETH");
  const [pricesFetched, setPricesFetched] = useState(false);
  const [shouldFetchPrices, setShouldFetchPrices] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [lastEditedField, setLastEditedField] = useState<'sell' | 'buy'>('sell');
  
  // Add ref for sell input auto-focus
  const sellInputRef = useRef<HTMLInputElement>(null);
  
  const { connected, connecting } = useWallet();
  const { refreshPrices } = useContext(NablaAntennaContext);
  
  const assetIds: string[] = Object.values(TOKENS).map(token => token.priceId);
  const priceIds: string[] = [TOKENS[sellToken]?.priceId, TOKENS[buyToken]?.priceId].filter(Boolean);
  const prices = useNablaAntennaPrices(priceIds);

  const balance = useBalance({
    accountId: AccountId.fromBech32('mtst1qqquxrx6kh77vypk8j6lz6j5xullvu70'),
    // accountId: AccountId.fromHex('0x01c30cdab5fde610363cb5f16a5437'),
    faucetId: AccountId.fromBech32('mtst1qppen8yngje35gr223jwe6ptjy7gedn9'),
  });

  // Auto-focus sell input on mount
  useEffect(() => {
    if (sellInputRef.current) {
      sellInputRef.current.focus();
    }
  }, []);

  // Prefetch prices on mount
  useEffect(() => {
    const prefetchPrices = async (): Promise<void> => {
      if (!pricesFetched) {
        setShouldFetchPrices(true);
        await refreshPrices(assetIds);
        setPricesFetched(true);
      }
    };
    
    prefetchPrices();
  }, []); // Empty dependency array = run once on mount

  // Fetch balance on mount
  // useEffect(() => {
  //   if (balance) {
  //     console.log('MIDEN BALANCE', balance);
  //   }
  // }, [balance]);

  useEffect(() => {
    if (!prices || !pricesFetched) {
      return;
    }
    
    const sellTokenData = TOKENS[sellToken];
    const buyTokenData = TOKENS[buyToken];
    
    if (!sellTokenData || !buyTokenData) {
      return;
    }
    
    const sellPrice = prices[sellTokenData.priceId];
    const buyPrice = prices[buyTokenData.priceId];
    
    if (sellPrice && buyPrice && sellPrice.value > 0 && buyPrice.value > 0) {
      if (lastEditedField === 'sell' && sellAmount) {
        const sellAmountNum: number = parseFloat(sellAmount);
        if (!isNaN(sellAmountNum) && sellAmountNum > 0) {
          const buyAmountCalculated: number = (sellAmountNum * sellPrice.value) / buyPrice.value;
          const formattedBuyAmount: string = buyAmountCalculated.toFixed(8);
          setBuyAmount(formattedBuyAmount);
        }
      } else if (lastEditedField === 'buy' && buyAmount) {
        const buyAmountNum: number = parseFloat(buyAmount);
        if (!isNaN(buyAmountNum) && buyAmountNum > 0) {
          const sellAmountCalculated: number = (buyAmountNum * buyPrice.value) / sellPrice.value;
          const formattedSellAmount: string = sellAmountCalculated.toFixed(8);
          setSellAmount(formattedSellAmount);
        }
      }
    }
  }, [sellAmount, buyAmount, sellToken, buyToken, prices, pricesFetched, lastEditedField]);

  const handleSellAmountChange = (value: string): void => {
    setSellAmount(value);
    setLastEditedField('sell');
    if (!value) {
      setBuyAmount("");
    }
  };

  const handleBuyAmountChange = (value: string): void => {
    setBuyAmount(value);
    setLastEditedField('buy');
    if (!value) {
      setSellAmount("");
    }
  };

  const fetchPrices = async (): Promise<void> => {
    if (!pricesFetched) {
      setShouldFetchPrices(true);
      await refreshPrices(assetIds);
      setPricesFetched(true);
    }
  };

const handleReplaceTokens = (): void => {
    // Simply swap all values without any async operations or recalculations
    const newSellToken = buyToken;
    const newBuyToken = sellToken;
    const newSellAmount = buyAmount;
    const newBuyAmount = sellAmount;
    const newLastEditedField = lastEditedField === 'sell' ? 'buy' : 'sell';
    
    // Update all state in one batch to avoid intermediate renders
    setSellToken(newSellToken);
    setBuyToken(newBuyToken);
    setSellAmount(newSellAmount);
    setBuyAmount(newBuyAmount);
    setLastEditedField(newLastEditedField);
    
    // Focus the sell input after swap
    if (sellInputRef.current) {
      sellInputRef.current.focus();
    }
  };

  const handleSwap = async (): Promise<void> => {
    if (!connected) {
      return;
    }
    
    // Validate amounts before proceeding
    const sellAmountNum: number = parseFloat(sellAmount);
    const buyAmountNum: number = parseFloat(buyAmount);
    
    if (isNaN(sellAmountNum) || isNaN(buyAmountNum) || sellAmountNum <= 0 || buyAmountNum <= 0) {
      console.error("Invalid amounts for swap:", { sellAmount, buyAmount, sellAmountNum, buyAmountNum });
      return;
    }
    
    if (sellToken === buyToken) {
      return;
    }
    
    console.log("Creating Zoro swap note with:", { sellAmount, buyAmount, sellToken, buyToken });
    
    // Fetch latest prices before creating swap note
    await refreshPrices(assetIds, true);

    setIsCreatingNote(true);
    
    try {
      // Pass actual swap parameters to compileZoroSwapNote
      const swapParams = {
        sellToken,
        buyToken, 
        sellAmount,
        buyAmount
      };
      
      await compileZoroSwapNote(swapParams);
      
    } catch (error) {
      console.error("Swap note creation failed:", error);
    } finally {
      setIsCreatingNote(false);
    }
  };

  const sellTokenData = TOKENS[sellToken];
  const buyTokenData = TOKENS[buyToken];
  const sellPrice = sellTokenData ? prices[sellTokenData.priceId] : null;
  const buyPrice = buyTokenData ? prices[buyTokenData.priceId] : null;

  // Calculate values for display
  const sellUsdValue: string = sellPrice ? calculateUsdValue(sellAmount, sellPrice.value) : "";
  const buyUsdValue: string = buyPrice ? calculateUsdValue(buyAmount, buyPrice.value) : "";
  const priceFor1: string = sellPrice ? calculateUsdValue("1", sellPrice.value) : "";
  
  // Format token amounts for display
  const formattedSellAmount: string = formatTokenAmount(sellAmount, sellToken);

  const canSwap: boolean = Boolean(
    sellAmount && 
    buyAmount && 
    !isNaN(parseFloat(sellAmount)) && 
    !isNaN(parseFloat(buyAmount)) &&
    parseFloat(sellAmount) > 0 &&
    parseFloat(buyAmount) > 0 &&
    sellPrice && 
    buyPrice &&
    sellToken !== buyToken
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PriceFetcher shouldFetch={shouldFetchPrices} assetIds={assetIds} />
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-3 sm:p-4 -mt-20">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex bg-muted rounded-full p-0.5 sm:p-1">
              {(["Swap", "Limit"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
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

          <Card className="border rounded-xl sm:rounded-2xl">
            <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <div className="text-xs sm:text-sm">Sell</div>
                <Card className="bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none">
                  <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        ref={sellInputRef}
                        type="number"
                        value={sellAmount}
                        onChange={(e) => handleSellAmountChange(e.target.value)}
                        onClick={fetchPrices}
                        placeholder="0"
                        className="border-none text-3xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-b-0 border-l-0 rounded-full pl-0 text-xs sm:text-sm bg-background cursor-default hover:bg-background disabled:opacity-50"
                      >
                        <img 
                          src={sellToken + ".svg"} 
                          alt="sell token logo" 
                          className={`w-8 h-8 -ml-2 ${
                            sellToken === 'ETH' ? 'dark:invert' : ''
                          }`} 
                        />
                        {sellToken}
                      </Button>
                    </div>
                    
                    {/* USD Value Display */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground h-5">
                      <div>{sellUsdValue || priceFor1}</div>
                      <div className="">{formattedSellAmount}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center -my-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border dark:bg-black bg-white dark:text-white text-black hover:text-black dark:hover:bg-gray-500/10 hover:bg-gray-500/10 dark:hover:text-white"
                  onClick={handleReplaceTokens}
                >
                  <ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-xs sm:text-sm">Get</div>
                <Card className="bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none">
                  <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        type="number"
                        value={buyAmount}
                        onChange={(e) => handleBuyAmountChange(e.target.value)}
                        onClick={fetchPrices}
                        placeholder="0"
                        className="border-none text-3xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner bg-transparent"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="border-b-0 border-l-0 rounded-full pl-0 text-xs sm:text-sm bg-background cursor-default hover:bg-background disabled:opacity-50"
                      > 
                        <img 
                          src={buyToken + ".svg"} 
                          alt="buy token logo" 
                          className={`w-8 h-8 -ml-2 ${
                            buyToken === 'ETH' ? 'dark:invert' : ''
                          }`} 
                        />
                        {buyToken}
                      </Button>
                    </div>
                    
                    {/* USD Value Display */}
                    <div className="flex items-center justify-center text-xs text-muted-foreground h-5">
                      <div className="text-green-500">{buyUsdValue}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="w-full h-12 sm:h-16 mt-4 sm:mt-6">
                {connected ? (
                  <Button 
                    onClick={handleSwap}
                    disabled={!canSwap || connecting || isCreatingNote}
                    variant="outline"
                    className="w-full h-full rounded-xl font-medium text-sm sm:text-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : isCreatingNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Note...
                      </>
                    ) : !canSwap ? (
                      sellToken === buyToken ? "Select different tokens" : "Enter amount"
                    ) : (
                      "Swap"
                    )}
                  </Button>
                ) : (
                  <div className="w-full h-full">
                    <WalletMultiButton 
                      disabled={connecting}
                      className="!w-full !h-full !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !text-muted-foreground hover:!text-foreground hover:!bg-gray-500/10 !text-center !flex !items-center !justify-center !border-none !p-0"
                    >
                      {connecting ? "Connecting..." : "Connect Wallet"}
                    </WalletMultiButton>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Faucet Link */}
          <div className="text-center">
            <Link to="/faucet">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Thirsty for test tokens? Visit the Faucet →
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Swap;