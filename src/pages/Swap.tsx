import { Header } from '@/components/Header';
import { ModeToggle } from '@/components/ModeToggle';
import { SwapSettings } from '@/components/SwapSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSwapState, useTokenInitialization } from '@/hooks/useSwapState';
import { getAssetIds, TOKENS } from '@/lib/config';
import {
  balanceToDecimalString,
  calculateMinAmountOut,
  calculateTokenPrice,
  calculateUsdValues,
  canPerformSwap,
  extractTokenData,
  formatBalance,
  getBalanceValidation,
} from '@/lib/swapHelpers';
import { useWallet, WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NablaAntennaContext, useNablaAntennaPrices } from '../components/PriceFetcher';
import { compileZoroSwapNote, type SwapParams } from '../lib/ZoroSwapNote.ts';

type TabType = 'Swap' | 'Limit';

interface PriceFetcherProps {
  readonly shouldFetch: boolean;
  readonly assetIds: readonly string[];
}

const PriceFetcher: React.FC<PriceFetcherProps> = ({ shouldFetch, assetIds }) => {
  const { refreshPrices } = useContext(NablaAntennaContext);

  useEffect(() => {
    if (!shouldFetch) return;
    refreshPrices(assetIds);
  }, [shouldFetch, refreshPrices, assetIds]);

  return null;
};

function Swap() {
  const [activeTab, setActiveTab] = useState<TabType>('Swap');
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [shouldFetchPrices, setShouldFetchPrices] = useState<boolean>(false);

  const { connecting, requestTransaction } = useWallet();

  // Use centralized swap state
  const {
    state,
    actions,
    balances,
    refs,
    context,
    accountId,
    client,
  } = useSwapState();

  const {
    sellAmount,
    buyAmount,
    sellToken,
    buyToken,
    slippage,
    lastEditedField,
    isFetchingQuote,
    isSwappingTokens,
    tokensLoaded,
    availableTokens,
    pricesFetched,
  } = state;

  const {
    setSellAmount,
    setBuyAmount,
    setSlippage,
    setLastEditedField,
    setIsFetchingQuote,
    setIsSwappingTokens,
    setTokensLoaded,
    setAvailableTokens,
    setPricesFetched,
  } = actions;

  const {
    sellBalance,
    buyBalance,
    sellBalanceLoading,
    buyBalanceLoading,
    refreshSellBalance,
    refreshBuyBalance,
  } = balances;

  const { debounceRef, sellInputRef } = refs;
  const { refreshPrices } = context;

  // Initialize tokens
  useTokenInitialization(
    setTokensLoaded,
    setAvailableTokens,
    actions.setSellToken,
    actions.setBuyToken,
  );

  // Asset IDs and price data
  const assetIds: readonly string[] = useMemo(() => tokensLoaded ? getAssetIds() : [], [
    tokensLoaded,
  ]);

  const priceIds: string[] = useMemo(() => {
    if (!sellToken || !buyToken || !tokensLoaded) return [];
    return [TOKENS[sellToken]?.priceId, TOKENS[buyToken]?.priceId].filter(Boolean);
  }, [sellToken, buyToken, tokensLoaded]);

  const prices = useNablaAntennaPrices(priceIds);

  // Derived data
  const tokenData = useMemo(
    () => extractTokenData(sellToken, buyToken, tokensLoaded, prices),
    [sellToken, buyToken, tokensLoaded, prices],
  );

  const balanceValidation = useMemo(() => {
    if (!sellToken) return { hasInsufficientBalance: false, isBalanceLoaded: false };
    return getBalanceValidation(sellAmount, sellBalance, sellToken);
  }, [sellAmount, sellBalance, sellToken]);

  const usdValues = useMemo(() => calculateUsdValues(sellAmount, buyAmount, tokenData), [
    sellAmount,
    buyAmount,
    tokenData,
  ]);

  const canSwap = useMemo(() =>
    canPerformSwap(
      sellAmount,
      buyAmount,
      tokenData,
      sellToken,
      buyToken,
      tokensLoaded,
      balanceValidation,
      isSwappingTokens,
    ), [
    sellAmount,
    buyAmount,
    tokenData,
    sellToken,
    buyToken,
    tokensLoaded,
    balanceValidation,
    isSwappingTokens,
  ]);

  const formattedSellBalance = useMemo(() => {
    if (!sellToken || sellBalance === null) return '0';
    return formatBalance(sellBalance, sellToken);
  }, [sellBalance, sellToken]);

  const formattedBuyBalance = useMemo(() => {
    if (!buyToken || buyBalance === null) return '0';
    return formatBalance(buyBalance, buyToken);
  }, [buyBalance, buyToken]);

  // Price calculation function
  const calculateAndSetPrice = useCallback((
    sellAmt: string,
    buyAmt: string,
    field: 'sell' | 'buy',
  ) => {
    const result = calculateTokenPrice(sellAmt, buyAmt, field, tokenData, slippage);

    if (result.sellAmount) setSellAmount(result.sellAmount);
    if (result.buyAmount) setBuyAmount(result.buyAmount);

    setIsFetchingQuote(false);
  }, [tokenData, slippage, setSellAmount, setBuyAmount, setIsFetchingQuote]);

  // Input handlers with debouncing
  const handleSellAmountChange = useCallback((value: string): void => {
    setSellAmount(value);
    setLastEditedField('sell');

    if (!value) {
      setBuyAmount('');
      setIsFetchingQuote(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsFetchingQuote(true);

    debounceRef.current = setTimeout(() => {
      calculateAndSetPrice(value, '', 'sell');
    }, 300);
  }, [
    setSellAmount,
    setLastEditedField,
    setBuyAmount,
    setIsFetchingQuote,
    calculateAndSetPrice,
  ]);

  const handleBuyAmountChange = useCallback((value: string): void => {
    setBuyAmount(value);
    setLastEditedField('buy');

    if (!value) {
      setSellAmount('');
      setIsFetchingQuote(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsFetchingQuote(true);

    debounceRef.current = setTimeout(() => {
      calculateAndSetPrice('', value, 'buy');
    }, 300);
  }, [
    setBuyAmount,
    setLastEditedField,
    setSellAmount,
    setIsFetchingQuote,
    calculateAndSetPrice,
  ]);

  // Token replacement
  const handleReplaceTokens = useCallback(() => {
    if (!sellToken || !buyToken) return;

    setIsSwappingTokens(true);

    // Swap everything atomically
    actions.setSellToken(buyToken);
    actions.setBuyToken(sellToken);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setLastEditedField(lastEditedField === 'sell' ? 'buy' : 'sell');

    setTimeout(async () => {
      try {
        await client?.syncState();
      } finally {
        setIsSwappingTokens(false);
        sellInputRef.current?.focus();
      }
    }, 100);
  }, [
    client,
    sellToken,
    buyToken,
    buyAmount,
    sellAmount,
    lastEditedField,
    actions,
    setSellAmount,
    setBuyAmount,
    setLastEditedField,
    setIsSwappingTokens,
  ]);

  // Max balance handler
  const handleMaxClick = useCallback((): void => {
    if (sellBalance !== null && sellBalance > BigInt(0) && sellToken) {
      const maxAmount = balanceToDecimalString(sellBalance, sellToken);
      handleSellAmountChange(maxAmount);
      sellInputRef.current?.focus();
    }
  }, [sellBalance, sellToken, handleSellAmountChange]);

  // Swap handler
  const handleSwap = useCallback(async (): Promise<void> => {
    if (!sellToken || !buyToken || !canSwap || !client) return;

    const minAmountOutValue = calculateMinAmountOut(buyAmount, slippage);

    await Promise.all([
      refreshPrices(assetIds, true),
      client.syncState(),
    ]);

    setIsCreatingNote(true);

    try {
      const swapParams: SwapParams = {
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: minAmountOutValue,
        userAccountId: accountId,
        wallet: { adapter: { accountId } } as any,
        requestTransaction: requestTransaction || (async () => ''),
      };

      await compileZoroSwapNote(swapParams, client);

      // Clear form and refresh data after successful swap
      setSellAmount('');
      setBuyAmount('');
    } catch (error) {
      // Silent error handling
    } finally {
      setIsCreatingNote(false);
    }
  }, [
    client,
    sellAmount,
    buyAmount,
    sellToken,
    buyToken,
    slippage,
    canSwap,
    requestTransaction,
    refreshPrices,
    assetIds,
    refreshSellBalance,
    refreshBuyBalance,
    setSellAmount,
    setBuyAmount,
  ]);

  // Price fetching
  const fetchPrices = useCallback(async (): Promise<void> => {
    if (pricesFetched || !tokensLoaded || assetIds.length === 0) return;
    setShouldFetchPrices(true);
    await refreshPrices(assetIds);
    setPricesFetched(true);
  }, [pricesFetched, tokensLoaded, assetIds.length, refreshPrices, setPricesFetched]);

  const handleInputFocus = useCallback(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Effects
  useEffect(() => {
    if (sellInputRef.current && tokensLoaded) {
      sellInputRef.current.focus();
    }
  }, [tokensLoaded]);

  useEffect(() => {
    const prefetchPrices = async () => {
      if (!pricesFetched && tokensLoaded && assetIds.length > 0) {
        setShouldFetchPrices(true);
        await refreshPrices(assetIds);
        setPricesFetched(true);
      }
    };
    prefetchPrices();
  }, [refreshPrices, pricesFetched, tokensLoaded, assetIds.length, setPricesFetched]);

  useEffect(() => {
    if (lastEditedField === 'sell' && sellAmount) {
      calculateAndSetPrice(sellAmount, '', 'sell');
    } else if (lastEditedField === 'buy' && buyAmount) {
      calculateAndSetPrice('', buyAmount, 'buy');
    }
  }, [prices, calculateAndSetPrice, lastEditedField, sellAmount, buyAmount]);

  // Loading states
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

  if (availableTokens.length === 0) {
    return (
      <div className='min-h-screen bg-background text-foreground flex flex-col'>
        <Header />
        <main className='flex-1 flex items-center justify-center'>
          <div className='text-center space-y-4'>
            <div className='text-orange-600'>Failed to load token configuration</div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
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
                  onClick={() => setActiveTab(tab)}
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

            <div className='flex items-center gap-1 sm:gap-2'>
              <SwapSettings slippage={slippage} onSlippageChange={setSlippage} />
              <ModeToggle />
            </div>
          </div>

          <Card className='border rounded-xl sm:rounded-2xl'>
            <CardContent className='p-3 sm:p-4 space-y-3 sm:space-y-4'>
              {/* Sell Section */}
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

                    <div className='flex items-center justify-between text-xs text-muted-foreground h-5'>
                      <div>{usdValues.sellUsdValue || usdValues.priceFor1}</div>
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={handleMaxClick}
                          disabled={sellBalance === null || sellBalance === BigInt(0)}
                          className={`hover:text-foreground transition-colors cursor-pointer mr-1 ${
                            sellBalanceLoading
                              ? 'animate-pulse text-yellow-100'
                              : balanceValidation.isBalanceLoaded
                                  && balanceValidation.hasInsufficientBalance
                              ? 'text-orange-600 hover:text-destructive'
                              : 'dark:text-green-100 dark:hover:text-green-200'
                          }`}
                        >
                          {formattedSellBalance || 'Loading...'} {sellToken}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Swap Button */}
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

              {/* Buy Section */}
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

                    <div className='flex items-center justify-between text-xs text-muted-foreground h-5'>
                      <div>{usdValues.buyUsdValue || usdValues.priceFor1Buy}</div>
                      {buyBalance !== null && buyBalance > BigInt(0) && (
                        <div className={buyBalanceLoading ? 'animate-pulse' : ''}>
                          {formattedBuyBalance} {buyToken}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Action Button */}
              <div className='w-full h-12 sm:h-16 mt-4 sm:mt-6'>
                {client
                  ? (
                    <Button
                      onClick={handleSwap}
                      disabled={connecting || isCreatingNote || isSwappingTokens}
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
                        : isSwappingTokens
                        ? (
                          <>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            Swapping tokens...
                          </>
                        )
                        : (() => {
                          // Validation logic for button text only - doesn't block interaction
                          const sellAmountNum = parseFloat(sellAmount);
                          const buyAmountNum = parseFloat(buyAmount);

                          const hasValidAmounts = Boolean(
                            sellAmount && buyAmount
                              && !isNaN(sellAmountNum) && !isNaN(buyAmountNum)
                              && sellAmountNum > 0 && buyAmountNum > 0,
                          );

                          const hasValidTokens = Boolean(
                            sellToken && buyToken
                              && sellToken !== buyToken
                              && tokensLoaded,
                          );

                          const hasPriceData = Boolean(
                            tokenData.sellPrice && tokenData.buyPrice,
                          );

                          // Only show insufficient balance if we have definitive balance data
                          const showInsufficientBalance = Boolean(
                            balanceValidation.isBalanceLoaded
                              && balanceValidation.hasInsufficientBalance,
                          );

                          if (showInsufficientBalance) {
                            return `Insufficient ${sellToken} balance`;
                          }

                          if (!hasValidTokens) {
                            return sellToken === buyToken
                              ? 'Select different tokens'
                              : 'Select tokens';
                          }

                          if (!hasValidAmounts) {
                            return 'Enter amount';
                          }

                          if (!hasPriceData && isFetchingQuote) {
                            return (
                              <>
                                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                                Fetching price...
                              </>
                            );
                          }

                          if (!hasPriceData) {
                            return 'Price unavailable - Try anyway?';
                          }

                          return 'Swap';
                        })()}
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
