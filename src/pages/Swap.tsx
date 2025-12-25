import AssetIcon from '@/components/AssetIcon';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { poweredByMiden } from '@/components/PoweredByMiden';
import Slippage from '@/components/Slippage';
import { SwapSuccess } from '@/components/SwapSuccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBalance } from '@/hooks/useBalance';
import { useSwap } from '@/hooks/useSwap';
import { useOrderUpdates } from '@/hooks/useWebSocket';
import { DEFAULT_SLIPPAGE } from '@/lib/config';
import { OracleContext, useOraclePrices } from '@/providers/OracleContext';
import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider.tsx';
import { formalNumberFormat, formatTokenAmount } from '@/utils/format.ts';
import { emptyFn } from '@/utils/shared';
import { useWallet, WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { Loader2 } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { formatUnits, parseUnits } from 'viem';

const validateValue = (val: bigint, max: bigint) => {
  return val > max
    ? 'Amount too large'
    : val === BigInt(0)
    ? "Amount can't be zero"
    : val <= 0
    ? 'Invalid value'
    : undefined;
};

function Swap() {
  const { refreshPrices } = useContext(OracleContext);
  const { tokens, client, accountId } = useContext(
    ZoroContext,
  );
  const {
    swap,
    isLoading: isLoadingSwap,
    txId,
    noteId,
  } = useSwap();
  // Subscribe to all order updates from the start
  const { orderStatus } = useOrderUpdates();
  const { connecting, connected } = useWallet();
  const [selectedAssetBuy, setSelectedAssetBuy] = useState<undefined | TokenConfig>();
  const [selectedAssetSell, setSelectedAssetSell] = useState<undefined | TokenConfig>();
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const { balance: balanceSell, formatted: balanceSellFmt } = useBalance({
    token: selectedAssetSell,
  });
  const { balance: balancebuy, formatted: balanceBuyFmt } = useBalance({
    token: selectedAssetBuy,
  });

  const [rawBuy, setRawBuy] = useState<bigint>(BigInt(0));
  const [rawSell, setRawSell] = useState<bigint>(BigInt(0));
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  const [stringBuy, setStringBuy] = useState<string | undefined>('');
  const [stringSell, setStringSell] = useState<string | undefined>('');
  const [sellInputError, setSellInputError] = useState<string | undefined>(undefined);

  const priceIds = useMemo(() => [
    ...(selectedAssetBuy?.oracleId ? [selectedAssetBuy.oracleId] : []),
    ...(selectedAssetSell?.oracleId ? [selectedAssetSell.oracleId] : []),
  ], [selectedAssetBuy?.oracleId, selectedAssetSell?.oracleId]);

  const prices = useOraclePrices(priceIds);

  // Initial price fetch (WebSocket will handle real-time updates)
  useEffect(() => {
    refreshPrices(priceIds);
  }, [
    priceIds,
    refreshPrices,
  ]);

  useEffect(() => {
    if (!selectedAssetBuy && !selectedAssetSell && tokens) {
      setSelectedAssetSell(Object.values(tokens)[0]);
      setSelectedAssetBuy(Object.values(tokens)[1]);
    }
  }, [tokens, selectedAssetBuy, selectedAssetSell]);

  const [usdValueSell, usdValueBuy] = useMemo(() => {
    const res: [undefined | string, undefined | string] = [undefined, undefined];
    if (!selectedAssetSell) return res;
    const priceSell = prices[selectedAssetSell.oracleId]?.value;
    const tokenAmountSell = formatTokenAmount({
      value: rawSell > 0
        ? rawSell
        : parseUnits(stringSell ?? '', selectedAssetSell.decimals),
      expo: selectedAssetSell.decimals,
    });
    if (priceSell && tokenAmountSell) {
      res[0] = formalNumberFormat(tokenAmountSell * priceSell);
    }
    if (!selectedAssetBuy) return res;
    const priceBuy = prices[selectedAssetBuy.oracleId]?.value;
    const tokenAmountBuy = formatTokenAmount({
      value: rawBuy > 0
        ? rawBuy
        : parseUnits(stringBuy ?? '', selectedAssetBuy.decimals),
      expo: selectedAssetBuy.decimals,
    });
    if (priceBuy && tokenAmountBuy) {
      res[1] = formalNumberFormat(tokenAmountBuy * priceBuy);
    }
    return res;
  }, [
    selectedAssetSell,
    prices,
    rawSell,
    rawBuy,
    stringBuy,
    stringSell,
    selectedAssetBuy,
  ]);

  const [, priceAssetSell, assetsPriceRatio] = useMemo(() => {
    const res = [undefined, undefined, undefined];
    if (!selectedAssetBuy || !selectedAssetSell) {
      return res;
    }
    const priceBuy = prices[selectedAssetBuy.oracleId];
    const priceSell = prices[selectedAssetSell.oracleId];
    const ratio = Number(priceSell?.value ?? 0) / Number(priceBuy?.value ?? 1);
    return [priceBuy, priceSell, ratio];
  }, [
    prices,
    selectedAssetBuy,
    selectedAssetSell,
  ]);

  // const setAsset = useCallback((side: 'buy' | 'sell', symbol: string) => {
  //   const asset = Object.values(tokens).find(a => a.symbol === symbol);
  //   if (asset == null) return;
  //   if (side === 'buy') {
  //     if (selectedAssetSell?.symbol === asset.symbol) {
  //       setSelectedAssetSell(selectedAssetBuy);
  //     }
  //     setSelectedAssetBuy(asset);
  //   } else {
  //     if (selectedAssetBuy?.symbol === asset.symbol) {
  //       setSelectedAssetBuy(selectedAssetSell);
  //     }
  //     setSelectedAssetSell(asset);
  //   }
  // }, [selectedAssetBuy, selectedAssetSell, tokens]);

  const onInputChange = useCallback((val: string) => {
    val = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    const [setString, setOtherString] = [setStringSell, setStringBuy];
    const [setRaw, setOtherRaw] = [setRawSell, setRawBuy];
    const setError = setSellInputError;
    const decimalsSell = selectedAssetSell?.decimals || 6;
    const decimalsBuy = selectedAssetBuy?.decimals || 6;
    setString(val);
    if (val === '' || val === '.') {
      setError(undefined);
      setRaw(BigInt(0));
      setOtherString('0');
      setOtherRaw(BigInt(0));
      return;
    }
    const newSell = parseUnits(val, decimalsSell);
    const validationError = validateValue(newSell, balanceSell ?? BigInt(0));
    if (validationError) {
      setError(validationError);
    } else {
      setError(undefined);
      setRaw(newSell);
    }
    // set bigints
    const newBuy = BigInt(Math.floor((assetsPriceRatio ?? 1) * 1e12)) * newSell
      / BigInt(10 ** (decimalsSell - decimalsBuy + 12));
    setOtherRaw(newBuy);
    // set strings
    setOtherString(formatUnits(newBuy, decimalsBuy));
  }, [
    selectedAssetBuy?.decimals,
    selectedAssetSell?.decimals,
    balanceSell,
    setStringBuy,
    setStringSell,
    setRawBuy,
    setRawSell,
    setSellInputError,
    assetsPriceRatio,
  ]);

  const clearForm = useCallback(() => {
    setSellInputError(undefined);
    setRawBuy(BigInt(0));
    setRawSell(BigInt(0));
    setStringBuy('');
    setStringSell('');
  }, [
    setSellInputError,
    setRawBuy,
    setRawSell,
    setStringBuy,
    setStringSell,
  ]);

  useEffect(() => {
    onInputChange(stringSell ?? '');
  }, [prices, onInputChange, stringSell]);

  const swapPairs = useCallback(() => {
    const newAssetSell = selectedAssetBuy;
    const newAssetBuy = selectedAssetSell;
    setSelectedAssetBuy(newAssetBuy);
    setSelectedAssetSell(newAssetSell);
    onInputChange(stringBuy ?? '');
  }, [
    selectedAssetBuy,
    selectedAssetSell,
    stringBuy,
    onInputChange,
  ]);

  const onSwap = useCallback(() => {
    if (!selectedAssetBuy || !selectedAssetSell) {
      return;
    }
    // Calculate minimum output with slippage protection
    // minAmountOut = rawBuy * (1 - slippage/100)
    const slippageFactor = BigInt(Math.round((100 - slippage) * 1e6));
    const minAmountOut = rawBuy * slippageFactor / BigInt(1e8);
    swap({
      amount: rawSell,
      minAmountOut,
      buyToken: selectedAssetBuy,
      sellToken: selectedAssetSell,
    });
  }, [rawSell, rawBuy, slippage, selectedAssetBuy, selectedAssetSell, swap]);

  const handleMaxClick = useCallback(() => {
    onInputChange(
      formatUnits(balanceSell || BigInt(0), selectedAssetSell?.decimals || 6),
    );
  }, [onInputChange, balanceSell, selectedAssetSell?.decimals]);

  const buttonText = useMemo(() => {
    const loadingPrice = !(priceAssetSell?.value);
    const showInsufficientBalance = Boolean(
      rawSell > (balanceSell || BigInt(0)),
    );
    if (showInsufficientBalance) {
      return `Insufficient ${selectedAssetSell?.symbol} balance`;
    } else if (loadingPrice) {
      return 'Loading price…';
    } else return 'Swap';
  }, [
    rawSell,
    balanceSell,
    priceAssetSell,
    selectedAssetSell?.symbol,
  ]);

  const lastShownNoteId = useRef<string | undefined>(undefined);

  const onCloseSuccessModal = useCallback(() => {
    clearForm();
    setIsSuccessModalOpen(false);
  }, [clearForm]);

  useEffect(() => {
    if (noteId && noteId !== lastShownNoteId.current) {
      lastShownNoteId.current = noteId;
      setIsSuccessModalOpen(true);
      // Note: Already subscribed to all orders in useOrderUpdates([])
    }
  }, [noteId]);

  // Handle order status updates, show toast on failure
  useEffect(() => {
    if (noteId && orderStatus[noteId]?.status === 'failed') {
      toast.error('Swap order failed');
    }
  }, [noteId, orderStatus]);

  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col relative dotted-bg'>
      <title>Swap - ZoroSwap | DeFi on Miden</title>
      <meta property='og:title' content='Swap - ZoroSwap | DeFi on Miden' />
      <meta name='twitter:title' content='Swap - ZoroSwap | DeFi on Miden' />
      <Header />
      <main className='flex-1 flex items-center justify-center p-3 sm:p-4 -mt-4'>
        <div className='w-full max-w-[495px] space-y-4 sm:space-y-6'>
          {/* Sell Card */}
          <Card className='border rounded-sm sm:rounded-md'>
            <CardContent className='p-3 sm:p-4 space-y-3 sm:space-y-4'>
              <h1 className='sr-only'>Swap Tokens</h1>
              <div className='space-y-2'>
                <div className='flex gap-1 sm:gap-2 justify-between items-center'>
                  <div className='text-xs sm:text-sm text-primary font-medium'>Sell</div>
                  <Slippage slippage={slippage} onSlippageChange={setSlippage} />
                </div>
                <Card className='border-none'>
                  <CardContent className='!sm:px-0 !px-0 p-3 sm:p-4 space-y-2 sm:space-y-3'>
                    <div className='flex items-center justify-between gap-2'>
                      <Input
                        value={stringSell}
                        onChange={(e) => onInputChange(e.target.value)}
                        placeholder='0'
                        aria-errormessage={sellInputError}
                        className={`border-none text-3xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner ${
                          sellInputError
                            ? 'text-orange-600 placeholder:text-destructive/50'
                            : ''
                        }`}
                      />
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-auto border-1 rounded-xl px-3 py-2 text-xs sm:text-sm bg-background cursor-default hover:bg-background'
                      >
                        {selectedAssetSell && (
                          <>
                            <AssetIcon symbol={selectedAssetSell.symbol} />
                            {selectedAssetSell.symbol}
                          </>
                        )}
                      </Button>
                    </div>
                    {sellInputError && (
                      <div className='flex items-center justify-between text-xs h-5'>
                        <p className='text-xs text-orange-600'>
                          {sellInputError}
                        </p>
                      </div>
                    )}
                    <div className='flex items-center justify-between text-xs h-5'>
                      <div>{usdValueSell ? `$${usdValueSell}` : ''}</div>
                      {accountId && balanceSell !== null && balanceSell !== undefined
                        && (
                          <div className='flex items-center gap-1'>
                            <button
                              onClick={handleMaxClick}
                              disabled={balanceSell === BigInt(0)}
                              className={`hover:text-foreground transition-colors cursor-pointer mr-1 ${
                                sellInputError
                                  ? 'text-orange-600 hover:text-destructive'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {balanceSellFmt} {selectedAssetSell?.symbol ?? ''}
                            </button>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Swap Pairs */}
          <div className='flex justify-center -my-1'>
            <button
              onClick={swapPairs}
              disabled={isLoadingSwap}
              className='p-0 border-0 bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group'
            >
              <svg
                width='32'
                height='32'
                viewBox='0 0 57 57'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                className='transition-all'
              >
                <rect
                  y='0.000152588'
                  width='56.3444'
                  height='56.3444'
                  className='group-hover:fill-primary/10 transition-all fill-card'
                />
                <rect
                  x='0.352153'
                  y='0.352305'
                  width='55.6401'
                  height='55.6401'
                  stroke='black'
                  strokeOpacity='0.2'
                  strokeWidth='0.704305'
                  className='transition-all dark:stroke-white'
                />

                <g className='transition-all duration-300 ease hover:rotate-[180deg] active:rotate-[180deg] origin-center'>
                  <rect
                    x='0'
                    y='0'
                    width='100%'
                    height='100%'
                    stroke='0'
                    fill='transparent'
                    className='transition-all'
                  />
                  <path
                    d='M42.2621 23.9345L39.639 26.5554L39.639 22.4535C39.639 20.9267 38.9111 19.535 37.8719 18.4981C36.8349 17.4589 35.4432 16.731 33.9165 16.731C32.3691 16.7081 32.3691 19.0429 33.9165 19.02C34.6787 19.02 35.576 19.4366 36.2535 20.1164C36.9334 20.794 37.35 21.6912 37.35 22.4535L37.35 26.5576L34.7268 23.9322C33.6464 22.8106 31.9846 24.4724 33.1062 25.5528L37.5857 30.03C37.6923 30.1694 37.8294 30.2825 37.9866 30.3604C38.1438 30.4384 38.3168 30.4791 38.4922 30.4796C38.6676 30.48 38.8408 30.4401 38.9984 30.363C39.156 30.2858 39.2937 30.1735 39.4009 30.0346L39.4124 30.0209L43.8828 25.5482C44.954 24.5113 43.3425 22.8151 42.2621 23.9299M22.4669 37.348C21.7047 37.348 20.8074 36.9314 20.1299 36.2515C19.4501 35.574 19.0335 34.6767 19.0335 33.9145L19.0335 29.8126L21.6589 32.4358C22.7393 33.5436 24.3371 31.8544 23.2772 30.8175L18.7977 26.3379C18.6903 26.1976 18.5518 26.0841 18.3931 26.0062C18.2345 25.9284 18.06 25.8883 17.8833 25.8892C17.7065 25.8901 17.5324 25.9319 17.3746 26.0113C17.2167 26.0908 17.0794 26.2057 16.9734 26.3471L12.5007 30.8175C11.3791 31.8979 13.0409 33.5597 14.1213 32.4358L16.7445 29.8126L16.7445 33.9168C16.7445 35.4435 17.4724 36.8352 18.5116 37.8721C19.5485 38.9113 20.9402 39.6392 22.4669 39.6392C23.9891 39.6392 23.9891 37.3502 22.4669 37.3502'
                    className='fill-[#FF5500] light:group-hover:fill-black transition-all'
                  />
                </g>
              </svg>
            </button>
          </div>

          {/* Buy Card */}
          <Card className='border rounded-sm sm:rounded-md'>
            <CardContent className='p-3 sm:p-4 space-y-3 sm:space-y-4'>
              <div className='space-y-2'>
                <div className='text-xs sm:text-sm text-primary font-medium'>Buy</div>
                <Card className='border-none'>
                  <CardContent className='!sm:px-0 !px-0 p-3 sm:p-4 space-y-2 sm:space-y-3'>
                    <div className='flex items-center justify-between gap-2'>
                      <Input
                        type='number'
                        value={stringBuy}
                        onChange={emptyFn}
                        disabled
                        placeholder='0'
                        className='border-none text-3xl sm:text-4xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner bg-transparent'
                      />
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-auto border-1 rounded-xl px-3 py-2 text-xs sm:text-sm bg-background cursor-default hover:bg-background'
                      >
                        {selectedAssetBuy && (
                          <>
                            <AssetIcon symbol={selectedAssetBuy.symbol} />
                            {selectedAssetBuy.symbol}
                          </>
                        )}
                      </Button>
                    </div>
                    <div className='flex items-center justify-between text-xs h-5'>
                      <div>{usdValueBuy ? `$${usdValueBuy}` : ''}</div>
                      {balancebuy !== null && balancebuy !== undefined && (
                        <div className='text-muted-foreground mr-1'>
                          {balanceBuyFmt} {selectedAssetBuy?.symbol ?? ''}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Main Action Button */}
          <div className='w-full h-8 sm:h-12 mt-4 sm:mt-6'>
            {connected
              ? (
                <Button
                  onClick={onSwap}
                  disabled={connecting || isLoadingSwap || !client
                    || stringSell === '' || !!sellInputError}
                  variant='outline'
                  className={`w-full h-full rounded-xl font-bold text-sm sm:text-lg transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                    buttonText === 'Swap'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary'
                      : 'hover:border-orange-200/20 hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {connecting
                    ? (
                      <>
                        <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                        Connecting...
                      </>
                    )
                    : isLoadingSwap
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
                      className='w-full h-full rounded-xl font-semibold text-sm sm:text-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
                    >
                      <Loader2 className='w-10 h-10 animate-spin' />
                    </Button>
                  )}

                  <div className={connecting ? 'invisible' : 'visible'}>
                    <WalletMultiButton className='!p-5 w-full h-full !font-sans !rounded-xl !font-semibold !text-sm sm:!text-lg !bg-primary !text-primary-foreground hover:!bg-primary/90 !border-none !text-center !flex !items-center !justify-center'>
                      Connect Wallet
                    </WalletMultiButton>
                  </div>
                </div>
              )}
          </div>
          <p className='text-xs text-center opacity-40 min-h-6'>
            {selectedAssetBuy && selectedAssetSell && assetsPriceRatio
              ? (
                <span>
                  1 {selectedAssetBuy.symbol} = {assetsPriceRatio?.toPrecision(8)}{' '}
                  {selectedAssetSell.symbol}
                </span>
              )
              : null}
          </p>
          {/* Powered by MIDEN */}
          <div className='flex items-center justify-center'>
            {poweredByMiden}
          </div>
        </div>
      </main>
      <Footer />
      {isSuccessModalOpen && (
        <SwapSuccess
          onClose={onCloseSuccessModal}
          swapResult={{ txId, noteId }}
          swapDetails={{
            sellToken: selectedAssetSell,
            buyToken: selectedAssetBuy,
            buyAmount: rawBuy,
            sellAmount: rawSell,
          }}
          orderStatus={noteId ? orderStatus[noteId]?.status : undefined}
          title='Swap order'
        />
      )}
    </div>
  );
}

export default Swap;
