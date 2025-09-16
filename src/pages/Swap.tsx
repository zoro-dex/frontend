import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ModeToggle } from '@/components/ModeToggle';
import { SwapSettings } from '@/components/SwapSettings';
import { SwapSuccess } from '@/components/SwapSuccess.tsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBalance } from '@/hooks/useBalance.ts';
import { useTokenInitialization } from '@/hooks/useTokenInitialization.ts';
import { getAssetIds, TOKENS, type TokenSymbol, UI } from '@/lib/config';
import { Skeleton } from "@/components/ui/skeleton"
import {
  calculateMinAmountOut,
  calculateTokenPrice,
  calculateUsdValues,
  canPerformSwap,
  extractTokenData,
  formatBalance,
  getBalanceValidation,
} from '@/lib/swapHelpers';
import { bech32ToAccountId, instantiateClient } from '@/lib/utils.ts';
import {
  NablaAntennaContext,
  useNablaAntennaPrices,
} from '@/providers/NablaAntennaProvider';
import { type WebClient } from '@demox-labs/miden-sdk';
import { useWallet, WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';
import { compileZoroSwapNote, type SwapParams } from '../lib/ZoroSwapNote.ts';

function Swap() {
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const { connected, connecting, requestTransaction, accountId: rawAccountId } =
    useWallet();
  const [client, setClient] = useState<WebClient | undefined>(undefined);
  const [sellAmount, setSellAmount] = useState<string>('');
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [sellToken, setSellToken] = useState<TokenSymbol | undefined>(undefined);
  const [buyToken, setBuyToken] = useState<TokenSymbol | undefined>(undefined);
  const [slippage, setSlippage] = useState<number>(UI.defaultSlippage);
  const [lastEditedField, setLastEditedField] = useState<'sell' | 'buy'>('sell');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const accountId = useMemo(() => {
    if (rawAccountId != null) {
      return bech32ToAccountId(rawAccountId);
    } else return undefined;
  }, [rawAccountId]);
  const [tokensLoaded, setTokensLoaded] = useState<boolean>(false);
  const [availableTokens, setAvailableTokens] = useState<TokenSymbol[]>([]);
  const [swapResult, setSwapResult] = useState<{ txId: string; noteId: string } | null>(
    null,
  );
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const { refreshPrices } = useContext(NablaAntennaContext);
  const [swapDetails, setSwapDetails] = useState<
    {
      sellToken: TokenSymbol;
      buyToken: TokenSymbol;
      sellAmount: string;
      buyAmount: string;
    } | null
  >(null);

  // Refs for stable calculations
  const sellInputRef = useRef<HTMLInputElement>(null);

  // Initialize tokens
  useTokenInitialization(
    setTokensLoaded,
    setAvailableTokens,
    setSellToken,
    setBuyToken,
  );

  // Balance parameters
  const sellBalanceParams = useMemo(() => ({
    accountId,
    faucetId: sellToken && TOKENS[sellToken]
      ? bech32ToAccountId(TOKENS[sellToken].faucetId)
      : undefined,
  }), [accountId, sellToken]);

  const buyBalanceParams = useMemo(() => ({
    accountId,
    faucetId: buyToken && TOKENS[buyToken]
      ? bech32ToAccountId(TOKENS[buyToken].faucetId)
      : undefined,
  }), [accountId, buyToken]);

  useEffect(() => {
    if (
      client == null && accountId != null
      && sellBalanceParams.faucetId != null
      && buyBalanceParams.faucetId != null
    ) {
      (async () => {
        const client = await instantiateClient({
          accountsToImport: [
            accountId,
            // sellBalanceParams.faucetId as AccountId,
            // buyBalanceParams.faucetId as AccountId,
            // poolAccountId,
          ],
        });
        setClient(client);
      })();
    }
  }, [accountId, sellBalanceParams.faucetId, buyBalanceParams.faucetId]);

  // Balance hooks
  const { balance: sellBalance } = useBalance({
    accountId,
    faucetId: sellBalanceParams.faucetId,
    client,
  });

  const { balance: buyBalance } = useBalance({
    accountId,
    faucetId: buyBalanceParams.faucetId,
    client,
  });

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
    ), [
    sellAmount,
    buyAmount,
    tokenData,
    sellToken,
    buyToken,
    tokensLoaded,
    balanceValidation,
  ]);

  const formattedSellBalance = useMemo(() => {
    if (!sellToken || sellBalance === null) return '0';
    return formatBalance(sellBalance, sellToken);
  }, [sellBalance, sellToken]);

  const formattedBuyBalance = useMemo(() => {
    if (!buyToken || buyBalance === null) return '0';
    return formatBalance(buyBalance, buyToken);
  }, [buyBalance, buyToken]);

  const handleSellAmountChange = useCallback((value: string): void => {
    setSellAmount(value);
    setLastEditedField('sell');

    if (!value) {
      setBuyAmount('');
      return;
    }

    const result = calculateTokenPrice(value, '', 'sell', tokenData, slippage);
    if (result.buyAmount) setBuyAmount(result.buyAmount);
  }, [tokenData, slippage]);

  const handleBuyAmountChange = useCallback((value: string): void => {
    setBuyAmount(value);
    setLastEditedField('buy');

    if (!value) {
      setSellAmount('');
      return;
    }

    const result = calculateTokenPrice('', value, 'buy', tokenData, slippage);
    if (result.sellAmount) setSellAmount(result.sellAmount);
  }, [tokenData, slippage]);

  const handleReplaceTokens = useCallback(() => {
    if (!sellToken || !buyToken) return;
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setIsSwapping(true);

    setTimeout(() => {
      setIsSwapping(false);
      sellInputRef.current?.focus();
    }, 500);
  }, [
    sellToken,
    buyToken,
    buyAmount,
    sellAmount,
    lastEditedField,
    isSwapping,
  ]);

  const handleMaxClick = useCallback((): void => {
    if (sellBalance !== null && sellBalance > BigInt(0) && sellToken) {
      const decimals = TOKENS[sellToken]?.decimals || 8;
      const maxAmount = formatUnits(sellBalance, decimals);

      handleSellAmountChange(maxAmount);
      sellInputRef.current?.focus();
    }
  }, [sellBalance, sellToken, handleSellAmountChange]);

  const handleSwap = useCallback(async () => {
    if (!sellToken || !buyToken || !canSwap || !client) return;
    const minAmountOutValue = calculateMinAmountOut(buyAmount, slippage);
    await refreshPrices(assetIds, true);
    setIsCreatingNote(true);
    try {
      const swapParams: SwapParams = {
        sellToken,
        buyToken,
        sellAmount,
        buyAmount,
        minAmountOut: minAmountOutValue,
        userAccountId: accountId,
        requestTransaction: requestTransaction || (async () => ''),
      };

      const result = await compileZoroSwapNote(swapParams, client);

      setSwapResult(result);
      setSwapDetails({
        sellToken,
        buyToken,
        sellAmount,
        buyAmount,
      });
      setShowSuccessModal(true);
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
    accountId,
  ]);

  const handleCloseSuccessModal = useCallback(() => {
    setShowSuccessModal(false);
    setSwapResult(null);
    setSwapDetails(null);
  }, []);

  const handleInputFocus = useCallback(async () => {
    await refreshPrices(assetIds);
  }, [refreshPrices]);

  useEffect(() => {
    if (assetIds.length == 0) return;
    refreshPrices(assetIds);
    let priceFetchingInterval = setInterval(() => {
      refreshPrices(assetIds);
    }, 30000);
    return () => clearInterval(priceFetchingInterval);
  }, [assetIds]);

  useEffect(() => {
    if (sellInputRef.current && tokensLoaded) {
      sellInputRef.current.focus();
    }
  }, [tokensLoaded]);

  const buttonText = useMemo(() => {
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

    const showInsufficientBalance = Boolean(
      balanceValidation.isBalanceLoaded
        && balanceValidation.hasInsufficientBalance,
    );

    if (showInsufficientBalance) {
      return `Insufficient ${sellToken} balance`;
    } else if (!hasValidTokens) {
      return 'Select tokens';
    } else if (!hasValidAmounts) {
      return 'Enter amount';
    } else if (!hasPriceData) {
      return 'Price unavailable - Try anyway?';
    } else return 'Swap';
  }, [
    sellAmount,
    buyAmount,
    sellToken,
    buyToken,
    tokensLoaded,
    tokenData.sellPrice,
    tokenData.buyPrice,
    balanceValidation,
  ]);

  if (!tokensLoaded) 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="flex flex-col space-y-3">
          <Skeleton className="h-[375px] w-[350px] rounded-xl transition-all duration-400 ease-out opacity-20 border-2 border-green-200 dark:border-green-600" />
        </div>
      </div>
  );
  

  if (availableTokens.length === 0) {
    return (
      <div className='min-h-screen bg-background text-foreground flex flex-col'>
        <Header />
        <main className='flex-1 flex items-center justify-center'>
          <div className='text-center space-y-4'>
            <div className='text-orange-600'>Server is down, come again in a bit</div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col'>
      <Header />
      <main className='flex-1 flex items-center justify-center p-3 sm:p-4 -mt-4'>
        <div className='w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6'>
          <div>
            {
              /* SWAP/LIMIT TAB
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
            </div> */
            }
            <div className='flex gap-1 sm:gap-2 justify-end'>
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
                    <div className='flex items-center justify-between text-xs h-5'>
                      <div>{usdValues.sellUsdValue || usdValues.priceFor1}</div>
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={handleMaxClick}
                          disabled={sellBalance === null || sellBalance === BigInt(0)}
                          className={`hover:text-foreground transition-colors cursor-pointer mr-1 ${
                            balanceValidation.isBalanceLoaded
                              && balanceValidation.hasInsufficientBalance
                              ? 'text-orange-600 hover:text-destructive'
                              : 'text-green-700 hover:text-green-600 dark:text-green-200 dark:hover:text-green-300'
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
                  className='h-8 w-8 sm:h-10 sm:w-10 rounded-full border dark:text-white text-black hover:text-black dark:hover:bg-gray-500/10 hover:bg-gray-500/10 dark:hover:text-white'
                  onClick={handleReplaceTokens}
                  disabled={!sellToken || !buyToken || isCreatingNote || connecting
                    || isSwapping}
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
                    <div className='flex items-center justify-between text-xs h-5'>
                      <div>{usdValues.buyUsdValue || usdValues.priceFor1Buy}</div>
                      {buyBalance !== null && buyBalance > BigInt(0) && (
                        <div>
                          {formattedBuyBalance} {buyToken}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Action Button */}
              <div className='w-full h-12 sm:h-16 mt-4 sm:mt-6'>
                {connected
                  ? (
                    <Button
                      onClick={handleSwap}
                      disabled={connecting || isCreatingNote || !client}
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
                        : !client
                        ? (
                          <>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          </>
                        )
                        : buttonText}
                    </Button>
                  )
                  : (
                    <div className='relative w-full h-full'>
                      {connecting && (
                        <Button
                          disabled
                          variant='outline'
                          className='w-full h-full rounded-xl font-medium text-sm sm:text-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
                        >
                          <Loader2 className='w-10 h-10 animate-spin' />
                        </Button>
                      )}

                      <div className={connecting ? 'invisible' : 'visible'}>
                        <WalletMultiButton className='!p-5 !w-full !h-full !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !text-muted-foreground animate-pulse hover:!text-foreground hover:!bg-gray-500/10 !text-center !flex !items-center !justify-center'>
                          Connect wallet
                        </WalletMultiButton>
                      </div>
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
      <Footer />
      <SwapSuccess
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        swapResult={swapResult}
        swapDetails={swapDetails}
      />
    </div>
  );
}

export default Swap;