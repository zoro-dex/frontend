import { useState, useEffect, useContext, useRef, useMemo } from "react";
import { ArrowUpDown, Loader2, Settings, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { ModeToggle } from "@/components/ModeToggle";
import { useNablaAntennaPrices, NablaAntennaContext } from '../components/PriceFetcher';
import { compileZoroSwapNote } from '../lib/ZoroSwapNote.ts';
import { Link } from 'react-router-dom';
import { useWallet, WalletMultiButton } from "@demox-labs/miden-wallet-adapter";
import { useTokenBalance } from '@/hooks/useBalance';

type TabType = "Swap" | "Limit";
type TokenSymbol = keyof typeof TOKENS;

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

interface SwapSettingsProps {
  slippage: number;
  onSlippageChange: (slippage: number) => void;
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
 * Calculate minimum amount out considering slippage
 */
const calculateMinAmountOut = (buyAmount: string, slippagePercent: number): string => {
  const buyAmountNum = parseFloat(buyAmount);
  if (isNaN(buyAmountNum) || buyAmountNum <= 0) {
    return "";
  }
  
  const minAmount = buyAmountNum * (1 - slippagePercent / 100);
  return minAmount.toFixed(8);
};

/**
 * Minimal SwapSettings Component
 */
function SwapSettings({ slippage, onSlippageChange }: SwapSettingsProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(slippage.toString());

  const handleSlippageChange = (value: string): void => {
    setInputValue(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      onSlippageChange(numValue);
    }
  };

  const handleToggle = (): void => {
    setIsOpen(!isOpen);
    // Reset input to current slippage when opening
    if (!isOpen) {
      setInputValue(slippage.toString());
    }
  };

  const handleClose = (): void => {
    setIsOpen(false);
  };

  // Update input when slippage changes externally
  useEffect(() => {
    setInputValue(slippage.toString());
  }, [slippage]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className={`transition-all duration-200 hover:bg-accent hover:text-accent-foreground ${
          isOpen ? 'rotate-45' : 'rotate-0'
        }`}
        aria-label="Slippage settings"
      >
        <Settings className="h-4 w-4 sm:h-[1.2rem] sm:w-[1.2rem]" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={handleClose}
          />
          
          {/* Minimal Settings Panel */}
          <Card className="absolute top-10 right-0 w-[200px] sm:w-[220px] z-50 border shadow-lg">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Max slippage</h3>
                  <div className="group relative">
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border max-w-[200px] text-center">
                        Your transaction will revert if the price changes unfavorably by more than this percentage
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-5 w-5 hover:bg-accent hover:text-accent-foreground"
                  aria-label="Close settings"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Slippage Input */}
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type="number"
                    value={inputValue}
                    onChange={(e) => handleSlippageChange(e.target.value)}
                    className="text-center text-sm pr-8"
                    min="0"
                    max="50"
                    step="0.1"
                    placeholder="0.5"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
                
                {/* Conditional Warnings */}
                {slippage > 5 && (
                  <div className="text-xs text-destructive text-center">
                    ⚠️ High slippage risk
                  </div>
                )}
                
                {slippage < 0.1 && slippage > 0 && (
                  <div className="text-xs text-amber-500 text-center">
                    ⚡ May fail due to low slippage
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Format BigInt balance to human-readable string
 */
const formatBalance = (balance: bigint, decimals: number = 8): string => {
  if (balance === BigInt(0)) {
    return "0";
  }
  
  // Convert BigInt to number for formatting (be careful with precision)
  const divisor = BigInt(Math.pow(10, decimals));
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  // Format with appropriate decimal places
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return wholePart.toString();
  }
  
  return `${wholePart}.${trimmedFractional}`;
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

function Swap() {
  const [activeTab, setActiveTab] = useState<TabType>("Swap");
  const [sellAmount, setSellAmount] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [sellToken, setSellToken] = useState<TokenSymbol>("BTC");
  const [buyToken, setBuyToken] = useState<TokenSymbol>("ETH");
  const [pricesFetched, setPricesFetched] = useState<boolean>(false);
  const [shouldFetchPrices, setShouldFetchPrices] = useState<boolean>(false);
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [lastEditedField, setLastEditedField] = useState<'sell' | 'buy'>('sell');
  
  // Settings state (default 0.5%)
  const [slippage, setSlippage] = useState<number>(0.5);
  
  // Add ref for sell input auto-focus
  const sellInputRef = useRef<HTMLInputElement>(null);
  
  const { connected, connecting, wallet } = useWallet();
  const { refreshPrices } = useContext(NablaAntennaContext);
  
  // Get the user's account ID from the connected wallet
  const userAccountId = wallet?.adapter.accountId || null;
  
  // Use the improved token balance hook - no more duplication!
  const { 
    balance: sellTokenBalance, 
    isLoading: balanceLoading, 
    error: balanceError,
    refetch: refetchSellBalance
  } = useTokenBalance(sellToken, userAccountId);

  const assetIds: string[] = Object.values(TOKENS).map(token => token.priceId);
  const priceIds: string[] = [TOKENS[sellToken]?.priceId, TOKENS[buyToken]?.priceId].filter(Boolean);
  const prices = useNablaAntennaPrices(priceIds);

  // Format the balance for display
  const formattedBalance = useMemo(() => {
    if (balanceLoading) return "Your balance...";
    if (balanceError) return "Error";
    if (sellTokenBalance === BigInt(0)) return "0";
    
    const formatted = formatBalance(sellTokenBalance, 6);
    const num = parseFloat(formatted);
    
    // Show appropriate precision based on amount
    if (num >= 1000) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    } else if (num >= 1) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
    } else {
      return num.toLocaleString('en-US', { maximumFractionDigits: 8 });
    }
  }, [sellTokenBalance, balanceLoading, balanceError]);

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

  const handleMaxBalance = (): void => {
    if (!balanceLoading && sellTokenBalance > BigInt(0)) {
      const maxAmount = formatBalance(sellTokenBalance, 6);
      handleSellAmountChange(maxAmount);
    }
  };

  const handleSwap = async (): Promise<void> => {
    if (!connected || !userAccountId) {
      console.error("Wallet not connected or userAccountId missing");
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
      console.error("Cannot swap same token");
      return;
    }
    
    // Calculate minimum amount out with slippage protection
    const minAmountOut = calculateMinAmountOut(buyAmount, slippage);
    
    console.log("Creating Zoro swap note with:", { 
      sellAmount, 
      buyAmount, 
      minAmountOut,
      sellToken, 
      buyToken,
      slippage,
      userAccountId: userAccountId.toString()
    });
    
    // Fetch latest prices before creating swap note
    await refreshPrices(assetIds, true);

    setIsCreatingNote(true);
    
    try {
      // Pass AccountId directly - userAccountId is AccountId type here
      const swapParams = {
        sellToken,
        buyToken, 
        sellAmount,
        buyAmount: minAmountOut,
        userAccountId
      };
      
      await compileZoroSwapNote(swapParams);
      
      // Refetch balance after successful swap
      await refetchSellBalance();
      
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
  const minAmountOut: string = calculateMinAmountOut(buyAmount, slippage);

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
            
            {/* Settings and theme toggle */}
            <div className="flex items-center gap-1 sm:gap-2">
              <SwapSettings 
                slippage={slippage}
                onSlippageChange={setSlippage}
              />
              <ModeToggle />
            </div>
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
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={handleMaxBalance}
                          className="hover:text-foreground transition-colors cursor-pointer mr-1"
                          disabled={balanceLoading || sellTokenBalance === BigInt(0)}
                        >
                          {formattedBalance} {sellToken}
                        </button>
                      </div>
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
                    
                    {/* Min Amount Out Display */}
                    <div className="flex items-center justify-center text-xs text-muted-foreground h-5">
                      {buyAmount && minAmountOut && (
                        <div className="text-amber-500">
                          Min received: {minAmountOut} {buyToken}
                        </div>
                      )}
                      {!buyAmount && buyUsdValue && (
                        <div className="text-green-500">{buyUsdValue}</div>
                      )}
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