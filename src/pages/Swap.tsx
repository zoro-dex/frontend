import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ModeToggle } from '@/components/ModeToggle';
import { SwapSettings } from '@/components/SwapSettings';
import { SwapSuccess } from '@/components/SwapSuccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBalance } from '@/hooks/useBalance';
import { useSwap } from '@/hooks/useSwap';
import { DEFAULT_SLIPPAGE } from '@/lib/config';
import {
  NablaAntennaContext,
  useNablaAntennaPrices,
} from '@/providers/NablaAntennaProvider';
import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider.tsx';
import { formalNumberFormat, formatTokenAmount, roundDown } from '@/utils/format.ts';
import { emptyFn } from '@/utils/shared';
import { useWallet, WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { refreshPrices } = useContext(NablaAntennaContext);
  const { tokens, client, accountId } = useContext(
    ZoroContext,
  );
  const {
    swap,
    isLoading: isLoadingSwap,
    txId,
    noteId,
  } = useSwap();
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

  const prices = useNablaAntennaPrices(priceIds);

  useEffect(() => {
    refreshPrices(priceIds);
    const interval = setInterval(() => {
      refreshPrices(priceIds);
    }, 20000);
    return () => {
      clearInterval(interval);
    };
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
      expo: selectedAssetSell.decimals,
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

  const [_priceAssetBuy, priceAssetSell, assetsPriceRatio] = useMemo(() => {
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
    swap({
      amount: rawSell,
      minAmountOut: rawSell * BigInt(slippage * 1e6) / BigInt(1e8),
      buyToken: selectedAssetBuy,
      sellToken: selectedAssetSell,
    });
  }, [rawSell, slippage, selectedAssetBuy, selectedAssetSell, swap]);

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
      return 'Loading price';
    } else return 'Swap';
  }, [
    rawSell,
    balanceSell,
    priceAssetSell,
    selectedAssetSell?.symbol,
  ]);

  const onCloseSuccessModal = useCallback(() => {
    clearForm();
    setIsSuccessModalOpen(false);
  }, [clearForm]);

  useEffect(() => {
    if (noteId) {
      setIsSuccessModalOpen(true);
    }
  }, [noteId]);

  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col'>
      <Header />
      <main className='flex-1 flex items-center justify-center p-3 sm:p-4 -mt-4'>
        <div className='w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6'>
          <div>
            <div className='flex gap-1 sm:gap-2 justify-end'>
              <SwapSettings slippage={slippage} onSlippageChange={setSlippage} />
              <ModeToggle />
            </div>
          </div>
          <Card className='border rounded-xl sm:rounded-2xl hover:border-green-200/10'>
            <CardContent className='p-3 sm:p-4 space-y-3 sm:space-y-4'>
              <div className='space-y-2'>
                <div className='text-xs sm:text-sm'>Sell</div>
                <Card className='bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none'>
                  <CardContent className='p-3 sm:p-4 space-y-2 sm:space-y-3'>
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
                        className='border-b-0 border-l-0 rounded-full pl-0 text-xs sm:text-sm bg-background cursor-default hover:bg-background'
                      >
                        {selectedAssetSell && (
                          <>
                            <img
                              src={selectedAssetSell.icon}
                              alt='sell token logo'
                              className={`w-8 h-8 -ml-2 ${
                                selectedAssetSell.iconClass || ''
                              }`}
                            />
                            {selectedAssetSell.symbol}
                          </>
                        )}
                      </Button>
                    </div>
                    {sellInputError && (
                      <p className='text-xs text-orange-600'>
                        {sellInputError}
                      </p>
                    )}
                    <div className='flex items-center justify-between text-xs h-5'>
                      <div>{usdValueSell ? `$${usdValueSell}` : ''}</div>
                      {accountId && balanceSell
                        && (
                          <div className='flex items-center gap-1'>
                            <button
                              onClick={handleMaxClick}
                              disabled={balanceSell === BigInt(0)}
                              className={`hover:text-foreground transition-colors cursor-pointer mr-1 ${
                                sellInputError
                                  ? 'text-orange-600 hover:text-destructive'
                                  : 'text-green-800 hover:text-green-600 dark:text-teal-100 dark:hover:text-green-100'
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

              {/* Swap Button */}
              <div className='flex justify-center -my-1'>
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8 sm:h-10 sm:w-10 rounded-full border dark:hover:border-teal-200 dark:text-white text-black hover:text-black dark:hover:bg-gray-500/10 hover:bg-gray-100/10 dark:hover:text-white'
                  onClick={swapPairs}
                  disabled={isLoadingSwap}
                >
                  <ArrowUpDown className='w-3 h-3 sm:w-4 sm:h-4' />
                </Button>
              </div>

              {/* Buy Section */}
              <div className='space-y-2'>
                <div className='text-xs sm:text-sm'>Buy</div>
                <Card className='bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none'>
                  <CardContent className='p-3 sm:p-4 space-y-2 sm:space-y-3'>
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
                        className='border-b-0 border-l-0 rounded-full pl-0 text-xs sm:text-sm bg-background cursor-default hover:bg-background'
                      >
                        {selectedAssetBuy && (
                          <>
                            <img
                              src={selectedAssetBuy.icon}
                              alt='buy token logo'
                              className={`w-8 h-8 -ml-2 ${
                                selectedAssetBuy.iconClass || ''
                              }`}
                            />
                            {selectedAssetBuy.symbol}
                          </>
                        )}
                      </Button>
                    </div>
                    <div className='flex items-center justify-between text-xs h-5'>
                      <div>{usdValueBuy ? `$${usdValueBuy}` : ''}</div>
                      {balancebuy !== null && balancebuy > BigInt(0) && (
                        <div>
                          {balanceBuyFmt} {selectedAssetBuy?.symbol ?? ''}
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
                      onClick={onSwap}
                      disabled={connecting || isLoadingSwap || !client
                        || stringSell === '' || !!sellInputError}
                      variant='outline'
                      className='w-full h-full hover:border-teal-200/20 rounded-xl font-medium text-sm sm:text-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
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
                          className='w-full h-full rounded-xl font-medium text-sm sm:text-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
                        >
                          <Loader2 className='w-10 h-10 animate-spin' />
                        </Button>
                      )}

                      <div className={connecting ? 'invisible' : 'visible'}>
                        <WalletMultiButton className='!p-5 !w-full !h-full !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !text-foreground-muted !text-muted-foreground animate-pulse hover:!text-foreground hover:!bg-gray-500/10 !text-center !flex !items-center !justify-center'>
                          Connect wallet
                        </WalletMultiButton>
                      </div>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
          {selectedAssetBuy && selectedAssetSell && assetsPriceRatio
            ? (
              <p className='text-xs text-center opacity-40'>
                1 {selectedAssetBuy.symbol} = {assetsPriceRatio?.toPrecision(8)}{' '}
                {selectedAssetSell.symbol}
              </p>
            )
            : null}
          <div className='text-center'>
            <Link to='/faucet'>
              <Button
                variant='ghost'
                size='sm'
                className='text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors mt-4'
              >
                Thirsty for test tokens? Visit the Faucet →
              </Button>
            </Link>
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
        />
      )}
    </div>
  );
}

export default Swap;
