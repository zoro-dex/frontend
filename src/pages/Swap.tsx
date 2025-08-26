import { Header } from '@/components/Header';
import { ModeToggle } from '@/components/ModeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBalance } from '@/hooks/useBalance';
import {
  getAssetIds,
  initializeTokenConfig,
  TOKENS,
  type TokenSymbol,
  UI,
} from '@/lib/config';
import { midenClientService } from '@/lib/client';
import { AccountId } from '@demox-labs/miden-sdk';
import { useWallet, WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { ArrowUpDown, Info, Loader2, Settings, X } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NablaAntennaContext, useNablaAntennaPrices } from '../components/PriceFetcher';
import { compileZoroSwapNote, type SwapParams } from '../lib/ZoroSwapNote.ts';

type TabType = 'Swap' | 'Limit';

interface BalanceValidationState {
  readonly hasInsufficientBalance: boolean;
  readonly isBalanceLoaded: boolean;
}

interface PriceFetcherProps {
  readonly shouldFetch: boolean;
  readonly assetIds: readonly string[];
}

interface SwapSettingsProps {
  readonly slippage: number;
  readonly onSlippageChange: (slippage: number) => void;
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
    return '';
  }

  const minAmount = buyAmountNum * (1 - slippagePercent / 100);
  return minAmount.toFixed(8);
};

/**
 * Simple balance validation - no optimistic complexity
 */
const getBalanceValidation = (
  sellAmount: string,
  balance: bigint | null,
  tokenSymbol: TokenSymbol,
): BalanceValidationState => {
  const sellAmountNum = parseFloat(sellAmount);

  // If no amount entered, no validation needed
  if (!sellAmount || isNaN(sellAmountNum) || sellAmountNum <= 0) {
    return {
      hasInsufficientBalance: false,
      isBalanceLoaded: balance !== null,
    };
  }

  // If balance not loaded yet, assume it's sufficient (let user try)
  if (balance === null) {
    return {
      hasInsufficientBalance: false,
      isBalanceLoaded: false,
    };
  }

  // Convert sellAmount to BigInt using token-specific decimals
  const token = TOKENS[tokenSymbol];
  if (!token) {
    return {
      hasInsufficientBalance: false,
      isBalanceLoaded: false,
    };
  }

  const sellAmountBigInt = BigInt(
    Math.floor(sellAmountNum * Math.pow(10, token.decimals)),
  );

  return {
    hasInsufficientBalance: sellAmountBigInt > balance,
    isBalanceLoaded: true,
  };
};

function SwapSettings({ slippage, onSlippageChange }: SwapSettingsProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(slippage.toString());

  const handleSlippageChange = useCallback((value: string): void => {
    setInputValue(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      onSlippageChange(numValue);
    }
  }, [onSlippageChange]);

  const handleToggle = useCallback((): void => {
    setIsOpen(!isOpen);
    // Reset input to current slippage when opening
    if (!isOpen) {
      setInputValue(slippage.toString());
    }
  }, [isOpen, slippage]);

  const handleClose = useCallback((): void => {
    setIsOpen(false);
  }, []);

  // Update input when slippage changes externally
  useEffect(() => {
    setInputValue(slippage.toString());
  }, [slippage]);

  return (
    <div className='relative'>
      <Button
        variant='ghost'
        size='icon'
        onClick={handleToggle}
        className={`transition-all duration-200 hover:bg-accent hover:text-accent-foreground ${
          isOpen ? 'rotate-45' : 'rotate-0'
        }`}
        aria-label='Slippage settings'
      >
        <Settings className='h-4 w-4 sm:h-[1.2rem] sm:w-[1.2rem]' />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className='fixed inset-0 bg-black/20 z-40'
            onClick={handleClose}
          />

          {/* Minimal Settings Panel */}
          <Card className='absolute top-10 right-0 w-[200px] sm:w-[220px] z-50 border shadow-lg'>
            <CardContent className='p-4 space-y-3'>
              {/* Header */}
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <h3 className='text-sm font-semibold'>Max slippage</h3>
                  <div className='group relative'>
                    <Info className='h-3 w-3 text-muted-foreground cursor-help' />
                    {/* Tooltip on hover */}
                    <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10'>
                      <div className='bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border max-w-[200px] text-center'>
                        Your transaction will revert if the price changes unfavorably by
                        more than this percentage
                        <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover'>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={handleClose}
                  className='h-5 w-5 hover:bg-accent hover:text-accent-foreground'
                  aria-label='Close settings'
                >
                  <X className='h-3 w-3' />
                </Button>
              </div>

              {/* Slippage Input */}
              <div className='space-y-2'>
                <div className='relative'>
                  <Input
                    type='number'
                    value={inputValue}
                    onChange={(e) => handleSlippageChange(e.target.value)}
                    className='text-center text-sm pr-8'
                    min='0'
                    max='50'
                    step='0.1'
                    placeholder='0.5'
                  />
                  <span className='absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none'>
                    %
                  </span>
                </div>

                {/* Conditional Warnings */}
                {slippage > 5 && (
                  <div className='text-xs text-orange-600 text-center'>
                    High slippage risk
                  </div>
                )}

                {slippage < 0.1 && slippage > 0 && (
                  <div className='text-xs text-amber-500 text-center'>
                    May fail due to low slippage
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
 * Format BigInt balance to human-readable string with token-specific decimals
 */
const formatBalance = (balance: bigint, tokenSymbol: TokenSymbol): string => {
  if (balance === BigInt(0)) {
    return '0';
  }

  const token = TOKENS[tokenSymbol];
  if (!token) return '0';

  const divisor = BigInt(Math.pow(10, token.decimals));
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  // Format with appropriate decimal places
  const fractionalStr = fractionalPart.toString().padStart(token.decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  if (trimmedFractional === '') {
    return wholePart.toString();
  }

  return `${wholePart}.${trimmedFractional}`;
};

/**
 * Convert BigInt balance to decimal string for input fields
 */
const balanceToDecimalString = (balance: bigint, tokenSymbol: TokenSymbol): string => {
  const token = TOKENS[tokenSymbol];
  if (!token) return '0';

  const divisor = BigInt(Math.pow(10, token.decimals));
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(token.decimals, '0');
  return `${wholePart}.${fractionalStr}`.replace(/\.?0+$/, '');
};

/**
 * Calculate and format USD value for a token amount
 */
const calculateUsdValue = (amount: string, priceUsd: number): string => {
  const amountNum: number = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0 || !priceUsd) {
    return '';
  }

  const usdValue: number = amountNum * priceUsd;

  return usdValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Simple auto-refetch hook - no optimistic complexity
 */
const useAutoRefetch = (
  refreshCallback: () => Promise<void>,
  dependencies: readonly any[],
  enabled: boolean = true,
) => {
  const intervalRef = useRef<NodeJS.Timeout>();
  const isRefetching = useRef<boolean>(false);

  const stableRefreshCallback = useCallback(async () => {
    if (isRefetching.current) return;

    try {
      isRefetching.current = true;
      await refreshCallback();
    } catch (error) {
      // Silent error handling
    } finally {
      isRefetching.current = false;
    }
  }, [refreshCallback]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval
    intervalRef.current = setInterval(() => {
      stableRefreshCallback();
    }, 10000); // 10 seconds

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [stableRefreshCallback, enabled, ...dependencies]);

  // Stop interval when component unmounts
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
};

function Swap() {
  const [activeTab, setActiveTab] = useState<TabType>('Swap');
  const [sellAmount, setSellAmount] = useState<string>('');
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [tokensLoaded, setTokensLoaded] = useState<boolean>(false);
  const [availableTokens, setAvailableTokens] = useState<TokenSymbol[]>([]);
  const [sellToken, setSellToken] = useState<TokenSymbol | undefined>(undefined);
  const [buyToken, setBuyToken] = useState<TokenSymbol | undefined>(undefined);
  const [pricesFetched, setPricesFetched] = useState<boolean>(false);
  const [shouldFetchPrices, setShouldFetchPrices] = useState<boolean>(false);
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [lastEditedField, setLastEditedField] = useState<'sell' | 'buy'>('sell');
  const [isSwappingTokens, setIsSwappingTokens] = useState<boolean>(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);

  // Settings state (uses config default)
  const [slippage, setSlippage] = useState<number>(UI.defaultSlippage);

  // Add ref for sell input auto-focus
  const sellInputRef = useRef<HTMLInputElement>(null);

  // Refs for stable price calculations
  const pricesRef = useRef<any>(null);
  const tokensLoadedRef = useRef<boolean>(false);
  const sellTokenRef = useRef<TokenSymbol | undefined>(undefined);
  const buyTokenRef = useRef<TokenSymbol | undefined>(undefined);
  const isSwappingTokensRef = useRef<boolean>(false);

  const { connected, connecting, wallet, requestTransaction } = useWallet();
  const { refreshPrices } = useContext(NablaAntennaContext);

  // STABLE user account ID - prevent re-renders
  const stableUserAccountId = useMemo(() => {
    return wallet?.adapter?.accountId;
  }, [wallet?.adapter?.accountId]);

  // Sell token balance parameters
  const sellBalanceParams = useMemo(() => ({
    accountId: stableUserAccountId ? AccountId.fromBech32(stableUserAccountId) : null,
    faucetId: sellToken && TOKENS[sellToken]
      ? AccountId.fromBech32(TOKENS[sellToken].faucetId)
      : undefined,
  }), [stableUserAccountId, sellToken]);

  // Buy token balance parameters
  const buyBalanceParams = useMemo(() => ({
    accountId: stableUserAccountId ? AccountId.fromBech32(stableUserAccountId) : null,
    faucetId: buyToken && TOKENS[buyToken]
      ? AccountId.fromBech32(TOKENS[buyToken].faucetId)
      : undefined,
  }), [stableUserAccountId, buyToken]);

  // Simple balance hooks - no optimistic updates
  const {
    balance: sellBalance,
    isLoading: sellBalanceLoading,
    refreshBalance: refreshSellBalance,
  } = useBalance(sellBalanceParams);

  const {
    balance: buyBalance,
    isLoading: buyBalanceLoading,
    refreshBalance: refreshBuyBalance,
  } = useBalance(buyBalanceParams);

  // Initialize tokens on mount ONLY
  useEffect(() => {
    const loadTokens = async (): Promise<void> => {
      try {
        await initializeTokenConfig();
        const tokenSymbols = Object.keys(TOKENS) as TokenSymbol[];
        setAvailableTokens(tokenSymbols);

        // Set default tokens if available
        if (tokenSymbols.includes('BTC' as TokenSymbol)) {
          setSellToken('BTC' as TokenSymbol);
        }
        if (tokenSymbols.includes('ETH' as TokenSymbol)) {
          setBuyToken('ETH' as TokenSymbol);
        }

        setTokensLoaded(true);
      } catch (error) {
        setTokensLoaded(true); // Still set to true to show error state
      }
    };

    loadTokens();
  }, []); // Only run once on mount

  // Update refs when values change - but don't cause re-renders
  useEffect(() => {
    tokensLoadedRef.current = tokensLoaded;
  }, [tokensLoaded]);

  useEffect(() => {
    sellTokenRef.current = sellToken;
  }, [sellToken]);

  useEffect(() => {
    buyTokenRef.current = buyToken;
  }, [buyToken]);

  useEffect(() => {
    isSwappingTokensRef.current = isSwappingTokens;
  }, [isSwappingTokens]);

  // STABLE asset IDs - prevent re-calculations
  const assetIds: readonly string[] = useMemo(() => tokensLoaded ? getAssetIds() : [], [
    tokensLoaded,
  ] // Only depends on tokensLoaded, not on input changes
  );

  // STABLE price IDs - only change when tokens change, not on input
  const priceIds: string[] = useMemo(() => {
    if (!sellToken || !buyToken || !tokensLoaded) return [];
    return [TOKENS[sellToken]?.priceId, TOKENS[buyToken]?.priceId].filter(Boolean);
  }, [sellToken, buyToken, tokensLoaded]); // No input dependencies

  const prices = useNablaAntennaPrices(priceIds);

  // Update prices ref
  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);

  // Simple auto-refetch: prices and balances together every 10 seconds
  const autoRefetchCallback = useCallback(async () => {
    // Only refetch if we have tokens loaded and are connected
    if (!tokensLoaded || !connected || assetIds.length === 0) {
      return;
    }

    // Refresh prices and ALL balances together
    await Promise.allSettled([
      // Refresh prices
      refreshPrices(assetIds, true).catch(err => {
        // Silent error handling
      }),
      // Refresh all balances in one go
      midenClientService.refreshAllBalances().catch(err => {
        // Silent error handling
      }),
    ]);
  }, [
    tokensLoaded,
    connected,
    assetIds,
    refreshPrices,
  ]);

  // Enable auto-refetch when tokens are loaded and wallet is connected
  const autoRefetchEnabled = tokensLoaded && connected && assetIds.length > 0;

  useAutoRefetch(
    autoRefetchCallback,
    [tokensLoaded, connected, assetIds.length], // Dependencies that affect refetch
    autoRefetchEnabled,
  );

  // Simple balance validation - no optimistic complexity
  const balanceValidation = useMemo(() => {
    if (!sellToken) {
      return {
        hasInsufficientBalance: false,
        isBalanceLoaded: false,
      };
    }
    return getBalanceValidation(sellAmount, sellBalance, sellToken);
  }, [sellAmount, sellBalance, sellToken]);

  const formattedSellBalance = useMemo(() => {
    if (!sellToken || sellBalance === null) return '0';
    return formatBalance(sellBalance, sellToken);
  }, [sellBalance, sellToken]);

  const formattedBuyBalance = useMemo(() => {
    if (!buyToken || buyBalance === null) return '0';
    return formatBalance(buyBalance, buyToken);
  }, [buyBalance, buyToken]);

  const calculateAndSetPrice = useCallback((
    sellAmt: string,
    buyAmt: string,
    field: 'sell' | 'buy',
  ) => {
    // Use refs to avoid dependency on frequently changing values
    const currentPrices = pricesRef.current;
    const currentTokensLoaded = tokensLoadedRef.current;
    const currentSellToken = sellTokenRef.current;
    const currentBuyToken = buyTokenRef.current;
    const currentIsSwapping = isSwappingTokensRef.current;

    if (
      !currentPrices || !currentTokensLoaded || !currentSellToken || !currentBuyToken
      || currentIsSwapping
    ) {
      setIsFetchingQuote(false);
      return;
    }

    const sellTokenData = TOKENS[currentSellToken];
    const buyTokenData = TOKENS[currentBuyToken];

    if (!sellTokenData || !buyTokenData) {
      setIsFetchingQuote(false);
      return;
    }

    const sellPrice = currentPrices[sellTokenData.priceId];
    const buyPrice = currentPrices[buyTokenData.priceId];

    if (!sellPrice || !buyPrice || sellPrice.value <= 0 || buyPrice.value <= 0) {
      setIsFetchingQuote(false);
      return;
    }

    if (field === 'sell' && sellAmt) {
      const sellAmountNum = parseFloat(sellAmt);
      if (!isNaN(sellAmountNum) && sellAmountNum > 0) {
        // Calculate expected buy amount
        const expectedBuyAmount = (sellAmountNum * sellPrice.value) / buyPrice.value;
        // Apply slippage to show minimum guaranteed amount
        const minAmountOut = expectedBuyAmount * (1 - slippage / 100);
        setBuyAmount(minAmountOut.toFixed(8));
      }
    } else if (field === 'buy' && buyAmt) {
      const buyAmountNum = parseFloat(buyAmt);
      if (!isNaN(buyAmountNum) && buyAmountNum > 0) {
        // User entered min amount they want, calculate required sell amount
        // Reverse calculate: if they want this minimum, what's the expected amount?
        const expectedBuyAmount = buyAmountNum / (1 - slippage / 100);
        const sellAmountCalculated = (expectedBuyAmount * buyPrice.value)
          / sellPrice.value;
        setSellAmount(sellAmountCalculated.toFixed(8));
      }
    }
    
    setIsFetchingQuote(false);
  }, [slippage]); // Add slippage dependency

  // STABLE token data that doesn't depend on input amounts
  const tokenData = useMemo(() => {
    if (!sellToken || !buyToken || !tokensLoaded) {
      return {
        sellTokenData: undefined,
        buyTokenData: undefined,
        sellPrice: null,
        buyPrice: null,
      };
    }

    const sellTokenData = TOKENS[sellToken];
    const buyTokenData = TOKENS[buyToken];

    return {
      sellTokenData,
      buyTokenData,
      sellPrice: sellTokenData ? prices[sellTokenData.priceId] : null,
      buyPrice: buyTokenData ? prices[buyTokenData.priceId] : null,
    };
  }, [sellToken, buyToken, tokensLoaded, prices]); // No input dependencies

  // Calculate USD values separately to avoid re-renders on input
  const sellUsdValue = useMemo(() => {
    const { sellPrice } = tokenData;
    return sellPrice ? calculateUsdValue(sellAmount, sellPrice.value) : '';
  }, [sellAmount, tokenData.sellPrice]);

  const buyUsdValue = useMemo(() => {
    const { buyPrice } = tokenData;
    return buyPrice ? calculateUsdValue(buyAmount, buyPrice.value) : '';
  }, [buyAmount, tokenData.buyPrice]);

  const priceFor1 = useMemo(() => {
    const { sellPrice } = tokenData;
    return sellPrice ? calculateUsdValue('1', sellPrice.value) : '';
  }, [tokenData.sellPrice]);

  const priceFor1Buy = useMemo(() => {
    const { buyPrice } = tokenData;
    return buyPrice ? calculateUsdValue('1', buyPrice.value) : '';
  }, [tokenData.buyPrice]);

  // Simple canSwap calculation - accounts for loading states
  const canSwap: boolean = useMemo(() => {
    // Don't allow swap while balances are loading or fetching quote
    if (sellBalanceLoading || buyBalanceLoading || isSwappingTokens || isFetchingQuote) {
      return false;
    }

    // Basic validation first
    const hasValidAmounts = Boolean(
      sellAmount
        && buyAmount
        && !isNaN(parseFloat(sellAmount))
        && !isNaN(parseFloat(buyAmount))
        && parseFloat(sellAmount) > 0
        && parseFloat(buyAmount) > 0,
    );

    const hasValidTokens = Boolean(
      tokenData.sellPrice
        && tokenData.buyPrice
        && sellToken !== buyToken
        && sellToken
        && buyToken
        && tokensLoaded,
    );

    // Only check insufficient balance if balance is actually loaded
    const hasValidBalance = !balanceValidation.isBalanceLoaded
      || !balanceValidation.hasInsufficientBalance;

    return hasValidAmounts && hasValidTokens && hasValidBalance;
  }, [
    sellAmount,
    buyAmount,
    tokenData.sellPrice,
    tokenData.buyPrice,
    sellToken,
    buyToken,
    tokensLoaded,
    balanceValidation.hasInsufficientBalance,
    balanceValidation.isBalanceLoaded,
    sellBalanceLoading,
    buyBalanceLoading,
    isSwappingTokens,
    isFetchingQuote,
  ]);

  // Debounced input handlers - prevent immediate re-renders
  const debounceRef = useRef<NodeJS.Timeout>();

  const handleSellAmountChange = useCallback((value: string): void => {
    setSellAmount(value);
    setLastEditedField('sell');
    if (!value) {
      setBuyAmount('');
      setIsFetchingQuote(false);
      return;
    }

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Start fetching state
    setIsFetchingQuote(true);

    // Set new timeout for price calculation
    debounceRef.current = setTimeout(() => {
      calculateAndSetPrice(value, '', 'sell');
    }, 300); // 300ms debounce
  }, [calculateAndSetPrice]);

  const handleBuyAmountChange = useCallback((value: string): void => {
    setBuyAmount(value);
    setLastEditedField('buy');
    if (!value) {
      setSellAmount('');
      setIsFetchingQuote(false);
      return;
    }

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Start fetching state
    setIsFetchingQuote(true);

    // Set new timeout for price calculation
    debounceRef.current = setTimeout(() => {
      calculateAndSetPrice('', value, 'buy');
    }, 300); // 300ms debounce
  }, [calculateAndSetPrice]);

  // STABLE callbacks - prevent re-renders
  const fetchPrices = useCallback(async (): Promise<void> => {
    if (pricesFetched || !tokensLoaded || assetIds.length === 0) return;

    setShouldFetchPrices(true);
    await refreshPrices(assetIds);
    setPricesFetched(true);
  }, [pricesFetched, tokensLoaded, assetIds.length, refreshPrices]);

  const handleInputFocus = useCallback(() => {
    fetchPrices();
  }, [fetchPrices]);

  const handleMaxClick = useCallback((): void => {
    if (sellBalance !== null && sellBalance > BigInt(0) && sellToken) {
      const maxAmount = balanceToDecimalString(sellBalance, sellToken);
      handleSellAmountChange(maxAmount);
      if (sellInputRef.current) {
        sellInputRef.current.focus();
      }
    }
  }, [sellBalance, sellToken, handleSellAmountChange]);

  const handleReplaceTokens = useCallback((): void => {
    if (!sellToken || !buyToken) return;

    setIsSwappingTokens(true);

    // Store the swapped values
    const newSellToken = buyToken;
    const newBuyToken = sellToken;
    const newSellAmount = buyAmount;
    const newBuyAmount = sellAmount;
    const newLastEditedField = lastEditedField === 'sell' ? 'buy' : 'sell';

    // Update all states atomically
    setSellToken(newSellToken);
    setBuyToken(newBuyToken);
    setSellAmount(newSellAmount);
    setBuyAmount(newBuyAmount);
    setLastEditedField(newLastEditedField);

    // Force refresh balances after token swap to ensure immediate update
    setTimeout(async () => {
      try {
        // Force refresh all balances to ensure new token balances load immediately
        await midenClientService.refreshAllBalances();
      } catch (error) {
        // Silent error handling
      } finally {
        setIsSwappingTokens(false);
        if (sellInputRef.current) {
          sellInputRef.current.focus();
        }
      }
    }, 100); // Slightly longer timeout to ensure React updates
  }, [buyToken, sellToken, buyAmount, sellAmount, lastEditedField]);

  // Simple swap handler - no optimistic updates
  const handleSwap = useCallback(async (): Promise<void> => {
    if (!connected || !stableUserAccountId || !sellToken || !buyToken) {
      return;
    }

    const sellAmountNum: number = parseFloat(sellAmount);
    const buyAmountNum: number = parseFloat(buyAmount);

    if (
      isNaN(sellAmountNum) || isNaN(buyAmountNum) || sellAmountNum <= 0
      || buyAmountNum <= 0
    ) {
      return;
    }

    if (sellToken === buyToken) {
      return;
    }

    const minAmountOutValue = calculateMinAmountOut(buyAmount, slippage);

    // Refresh data before swap to ensure we have latest state
    await Promise.all([
      refreshPrices(assetIds, true),
      midenClientService.refreshAllBalances(),
    ]);

    setIsCreatingNote(true);

    try {
      const swapParams: SwapParams = {
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: minAmountOutValue,
        userAccountId: stableUserAccountId,
        wallet: wallet,
        requestTransaction: requestTransaction || (async () => ''),
      };

      const result = await compileZoroSwapNote(swapParams);

      // Clear form and refresh data after successful swap
      setSellAmount('');
      setBuyAmount('');
      
      // Refresh balances after swap - no optimistic updates needed
      setTimeout(() => {
        Promise.all([
          refreshSellBalance(),
          refreshBuyBalance(),
          midenClientService.refreshAllBalances()
        ]);
      }, 3000); // Give blockchain time to process

    } catch (error) {
      // Silent error handling
    } finally {
      setIsCreatingNote(false);
    }
  }, [
    connected,
    stableUserAccountId,
    sellAmount,
    buyAmount,
    sellToken,
    buyToken,
    slippage,
    wallet,
    requestTransaction,
    refreshPrices,
    assetIds,
    refreshSellBalance,
    refreshBuyBalance,
  ]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleSlippageChange = useCallback((newSlippage: number) => {
    setSlippage(newSlippage);
  }, []);

  // Auto-focus sell input on mount ONLY
  useEffect(() => {
    if (sellInputRef.current && tokensLoaded) {
      sellInputRef.current.focus();
    }
  }, [tokensLoaded]);

  // Prefetch prices when tokens are loaded ONLY
  useEffect(() => {
    const prefetchPrices = async (): Promise<void> => {
      if (!pricesFetched && tokensLoaded && assetIds.length > 0) {
        setShouldFetchPrices(true);
        await refreshPrices(assetIds);
        setPricesFetched(true);
      }
    };

    prefetchPrices();
  }, [refreshPrices, pricesFetched, tokensLoaded, assetIds.length]);

  // Price calculation effect - ONLY runs when prices change, not on input
  useEffect(() => {
    if (lastEditedField === 'sell' && sellAmount) {
      calculateAndSetPrice(sellAmount, '', 'sell');
    } else if (lastEditedField === 'buy' && buyAmount) {
      calculateAndSetPrice('', buyAmount, 'buy');
    }
  }, [prices]); // Only depend on prices, not on amounts or calculateAndSetPrice

  // Show loading state while tokens are being fetched
  if (!tokensLoaded) {
    return (
      <div className='min-h-screen bg-background text-foreground flex flex-col'>
        <Header />
        <main className='flex-1 flex items-center justify-center'>
          <div className='flex items-center gap-2'>
            <Loader2 className='w-5 h-5 animate-spin' />
            <span>Loading token configuration...</span>
          </div>
        </main>
      </div>
    );
  }

  // Show error state if no tokens are available
  if (availableTokens.length === 0) {
    return (
      <div className='min-h-screen bg-background text-foreground flex flex-col'>
        <Header />
        <main className='flex-1 flex items-center justify-center'>
          <div className='text-center space-y-4'>
            <div className='text-orange-600'>Failed to load token configuration</div>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col'>
      <PriceFetcher shouldFetch={shouldFetchPrices} assetIds={assetIds} />
      <Header />

      <main className='flex-1 flex items-center justify-center p-3 sm:p-4 -mt-20'>
        <div className='w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='flex bg-muted rounded-full p-0.5 sm:p-1'>
              {(['Swap', 'Limit'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'secondary' : 'ghost'}
                  size='sm'
                  onClick={() => handleTabChange(tab)}
                  className={`rounded-full text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 ${
                    activeTab === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </Button>
              ))}
            </div>

            {/* Settings and theme toggle */}
            <div className='flex items-center gap-1 sm:gap-2'>
              <SwapSettings
                slippage={slippage}
                onSlippageChange={handleSlippageChange}
              />
              <ModeToggle />
            </div>
          </div>

          <Card className='border rounded-xl sm:rounded-2xl'>
            <CardContent className='p-3 sm:p-4 space-y-3 sm:space-y-4'>
              <div className='space-y-2'>
                <div className='text-xs sm:text-sm'>Sell</div>
                <Card className='bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none'>
                  <CardContent className='p-3 sm:p-4 space-y-2 sm:space-y-3'>
                    <div className='flex items-center justify-between gap-2'>
                      <Input
                        ref={sellInputRef}
                        type='number'
                        value={sellAmount}
                        onChange={(e) => handleSellAmountChange(e.target.value)}
                        onFocus={handleInputFocus}
                        placeholder='0'
                        className={`border-none text-3xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner ${
                          balanceValidation.isBalanceLoaded
                            && balanceValidation.hasInsufficientBalance
                            ? 'text-orange-600 placeholder:text-destructive/50'
                            : ''
                        }`}
                      />
                      <Button
                        variant='outline'
                        size='sm'
                        className='border-b-0 border-l-0 rounded-full pl-0 text-xs sm:text-sm bg-background cursor-default hover:bg-background'
                      >
                        {sellToken && (
                          <>
                            <img
                              src={TOKENS[sellToken].icon}
                              alt='sell token logo'
                              className={`w-8 h-8 -ml-2 ${
                                TOKENS[sellToken].iconClass || ''
                              }`}
                            />
                            {sellToken}
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Simple USD value and balance display */}
                    <div className='flex items-center justify-between text-xs text-muted-foreground h-5'>
                      <div>{sellUsdValue || priceFor1}</div>
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={handleMaxClick}
                          disabled={sellBalance === null || sellBalance === BigInt(0)}
                          className={`hover:text-foreground transition-colors cursor-pointer mr-1 ${
                            balanceValidation.isBalanceLoaded
                              && balanceValidation.hasInsufficientBalance
                              ? 'text-orange-600 hover:text-destructive'
                              : 'dark:text-green-100 dark:hover:text-green-200'
                          } ${sellBalanceLoading ? 'animate-pulse' : ''}`}
                        >
                          {sellBalanceLoading && '⏳ '}
                          {formattedSellBalance || 'Loading...'} {sellToken}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className='flex justify-center -my-1'>
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8 sm:h-10 sm:w-10 rounded-full border dark:bg-black bg-white dark:text-white text-black hover:text-black dark:hover:bg-gray-500/10 hover:bg-gray-500/10 dark:hover:text-white'
                  onClick={handleReplaceTokens}
                  disabled={!sellToken || !buyToken || isCreatingNote || connecting
                    || isSwappingTokens}
                >
                  <ArrowUpDown className='w-3 h-3 sm:w-4 sm:h-4' />
                </Button>
              </div>

              <div className='space-y-2'>
                <div className='text-xs sm:text-sm'>Get</div>
                <Card className='bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none'>
                  <CardContent className='p-3 sm:p-4 space-y-2 sm:space-y-3'>
                    <div className='flex items-center justify-between gap-2'>
                      <Input
                        type='number'
                        value={buyAmount}
                        onChange={(e) => handleBuyAmountChange(e.target.value)}
                        onFocus={handleInputFocus}
                        placeholder='0'
                        className='border-none text-3xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner bg-transparent'
                      />
                      <Button
                        variant='outline'
                        size='sm'
                        className='border-b-0 border-l-0 rounded-full pl-0 text-xs sm:text-sm bg-background cursor-default hover:bg-background'
                      >
                        {buyToken && (
                          <>
                            <img
                              src={TOKENS[buyToken].icon}
                              alt='buy token logo'
                              className={`w-8 h-8 -ml-2 ${
                                TOKENS[buyToken].iconClass || ''
                              }`}
                            />
                            {buyToken}
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Display buy token balance */}
                    <div className='flex items-center justify-between text-xs text-muted-foreground h-5'>
                      <div>
                        {buyUsdValue || priceFor1Buy}
                      </div>
                      {/* Show buy token balance if available */}
                      {buyBalance !== null && buyBalance > BigInt(0) && (
                        <div className={buyBalanceLoading ? 'animate-pulse' : ''}>
                          {buyBalanceLoading && '⏳ '}
                          {formattedBuyBalance} {buyToken}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className='w-full h-12 sm:h-16 mt-4 sm:mt-6'>
                {connected
                  ? (
                    <Button
                      onClick={handleSwap}
                      disabled={!canSwap || connecting || isCreatingNote}
                      variant='outline'
                      className='w-full h-full rounded-xl font-medium text-sm sm:text-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
                    >
                      {connecting
                        ? (
                          <>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            Connecting...
                          </>
                        )
                        : isCreatingNote
                        ? (
                          <>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            Creating Note...
                          </>
                        )
                        : isFetchingQuote
                        ? (
                          <>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          </>
                        )
                        : balanceValidation.isBalanceLoaded
                            && balanceValidation.hasInsufficientBalance
                        ? (
                          `Insufficient ${sellToken} balance`
                        )
                        : !canSwap
                        ? (
                          sellToken === buyToken
                            ? 'Select different tokens'
                            : 'Enter amount'
                        )
                        : sellBalanceLoading || buyBalanceLoading
                        ? (
                          <>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            Loading balances...
                          </>
                        )
                        : (
                          'Swap'
                        )}
                    </Button>
                  )
                  : (
                    <div className='w-full h-full'>
                      <WalletMultiButton
                        disabled={connecting}
                        className='!w-full !h-full !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !text-muted-foreground hover:!text-foreground hover:!bg-gray-500/10 !text-center !flex !items-center !justify-center !border-none !p-0'
                      >
                        {connecting ? 'Connecting...' : 'Connect Wallet'}
                      </WalletMultiButton>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Faucet Link */}
          <div className='text-center'>
            <Link to='/faucet'>
              <Button
                variant='ghost'
                size='sm'
                className='text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors'
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