import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
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
import { formalNumberFormat, formatTokenAmount } from '@/utils/format.ts';
import { emptyFn } from '@/utils/shared';
import { useWallet, WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatUnits, parseUnits } from 'viem';

const validateValue = (val: bigint, max: bigint) => {
  console.log("max: " + max);
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
    <div className='min-h-screen bg-background text-foreground flex flex-col relative dotted-bg'>
      <Header />
      <main className='flex-1 flex items-center justify-center p-3 sm:p-4 -mt-4'>
        <div className='w-full max-w-xs sm:max-w-sm space-y-1 sm:space-y-1'>
          <Card className='border rounded-xl sm:rounded-2xl shadow-sm'>
            <CardContent className='p-3 sm:p-4 space-y-3 sm:space-y-4'>
              <div className='space-y-2'>
                <div className='flex gap-1 sm:gap-2 justify-end float-right'>
                  <SwapSettings slippage={slippage} onSlippageChange={setSlippage}/>
                </div>
                <div className='text-xs sm:text-sm text-primary font-medium'>Sell</div>
                <Card className='bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none'>
                  <CardContent className='p-2 sm:p-3 space-y-1 sm:space-y-2'>
                    <div className='flex items-center justify-between gap-2'>
                      <Input
                          value={stringSell}
                          onChange={(e) => onInputChange(e.target.value)}
                          placeholder='0'
                          aria-errormessage={sellInputError}
                          className={`border-none text-xl sm:text-2xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner ${
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

              {/* Swap Button */}
              <div className='flex justify-center -my-1'>
                <Button
                    variant='outline'
                    size='icon'
                  className='h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/30'
                  onClick={swapPairs}
                  disabled={isLoadingSwap}
                >
                  <ArrowUpDown className='w-3 h-3 sm:w-4 sm:h-4' />
                </Button>
              </div>

              {/* Buy Section */}
              <div className='space-y-2'>
                <div className='text-xs sm:text-sm text-primary font-medium'>Buy</div>
                <Card className='bg-gradient-to-b from-muted/10 from-10% to-muted/30 to-50% border-none'>
                  <CardContent className='p-2 sm:p-3 space-y-1 sm:space-y-2'>
                    <div className='flex items-center justify-between gap-2'>
                      <Input
                        type='number'
                        value={stringBuy}
                        onChange={emptyFn}
                        disabled
                        placeholder='0'
                        className='border-none text-xl sm:text-2xl font-light outline-none flex-1 p-0 h-auto focus-visible:ring-0 no-spinner bg-transparent'
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
                      className={`w-full h-full rounded-xl font-medium text-sm sm:text-lg transition-colors disabled:pointer-events-none disabled:opacity-50 ${
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
                          className='w-full h-full rounded-xl font-medium text-sm sm:text-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
                        >
                          <Loader2 className='w-10 h-10 animate-spin' />
                        </Button>
                      )}

                      <div className={connecting ? 'invisible' : 'visible'}>
                        <WalletMultiButton className='!p-5 !w-full !h-full !rounded-xl !font-medium !text-sm sm:!text-lg !bg-primary !text-primary-foreground hover:!bg-primary/90 !border-none !text-center !flex !items-center !justify-center'>
                          Connect Wallet
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
          {/* Powered by MIDEN */}
          <div className="flex items-center justify-center">
            <svg width="118" height="16" viewBox="0 0 118 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                  d="M0.757064 11.4476H1.50386V5.41179H0.757064V4.85936H4.35807C5.0469 4.85936 5.56864 5.02304 5.92329 5.35041C6.28475 5.67777 6.46548 6.15859 6.46548 6.79286C6.46548 7.43395 6.27793 7.9284 5.90283 8.27623C5.52772 8.62405 4.99575 8.79797 4.30692 8.79797H2.72125V11.4476H3.69312V12H0.757064V11.4476ZM2.72125 8.19439H4.08186C4.44333 8.19439 4.71954 8.09209 4.9105 7.88748C5.10828 7.68288 5.20718 7.41008 5.20718 7.06907V6.58825C5.20718 6.24725 5.10828 5.97445 4.9105 5.76984C4.71954 5.56524 4.44333 5.46294 4.08186 5.46294H2.72125V8.19439ZM8.99161 11.5192C9.42128 11.5192 9.735 11.3862 9.93278 11.1202C10.1374 10.8542 10.2397 10.4996 10.2397 10.0563V8.62405C10.2397 8.18075 10.1374 7.8261 9.93278 7.56012C9.735 7.29413 9.42128 7.16114 8.99161 7.16114C8.56194 7.16114 8.24481 7.29413 8.04021 7.56012C7.84242 7.8261 7.74353 8.18075 7.74353 8.62405V10.0563C7.74353 10.4996 7.84242 10.8542 8.04021 11.1202C8.24481 11.3862 8.56194 11.5192 8.99161 11.5192ZM8.99161 12.1228C8.6165 12.1228 8.2755 12.058 7.96859 11.9284C7.66169 11.7988 7.39912 11.6147 7.18087 11.376C6.96263 11.1373 6.79213 10.8474 6.66937 10.5064C6.55343 10.1586 6.49545 9.76983 6.49545 9.34016C6.49545 8.9105 6.55343 8.52516 6.66937 8.18416C6.79213 7.83633 6.96263 7.54307 7.18087 7.30436C7.39912 7.06566 7.66169 6.88152 7.96859 6.75194C8.2755 6.62235 8.6165 6.55756 8.99161 6.55756C9.36671 6.55756 9.70772 6.62235 10.0146 6.75194C10.3215 6.88152 10.5841 7.06566 10.8023 7.30436C11.0206 7.54307 11.1877 7.83633 11.3036 8.18416C11.4264 8.52516 11.4878 8.9105 11.4878 9.34016C11.4878 9.76983 11.4264 10.1586 11.3036 10.5064C11.1877 10.8474 11.0206 11.1373 10.8023 11.376C10.5841 11.6147 10.3215 11.7988 10.0146 11.9284C9.70772 12.058 9.36671 12.1228 8.99161 12.1228ZM11.8312 7.23275H11.3197V6.68033H13.6726V7.23275H12.9872L13.9181 10.8747H13.9693L15.1458 6.68033H16.0869L17.2634 10.8747H17.3145L18.2455 7.23275H17.5601V6.68033H19.3913V7.23275H18.8798L17.5294 12H16.5677L15.3811 8.02047H15.3299L14.1432 12H13.1816L11.8312 7.23275ZM21.7103 12.1228C21.3147 12.1228 20.9635 12.058 20.6566 11.9284C20.3497 11.792 20.0905 11.601 19.8791 11.3555C19.6677 11.11 19.504 10.8167 19.3881 10.4757C19.279 10.1347 19.2244 9.75619 19.2244 9.34016C19.2244 8.91732 19.2824 8.53539 19.3983 8.19439C19.5211 7.85338 19.6882 7.56353 19.8996 7.32482C20.1178 7.0793 20.3736 6.89175 20.6668 6.76217C20.9669 6.62576 21.2943 6.55756 21.6489 6.55756C22.0104 6.55756 22.3344 6.61894 22.6208 6.74171C22.9072 6.85765 23.1494 7.02474 23.3471 7.24298C23.5517 7.46123 23.7086 7.7238 23.8177 8.0307C23.9268 8.33761 23.9814 8.67861 23.9814 9.05372V9.32993H20.4622V9.6573C20.4622 10.1893 20.5952 10.6019 20.8612 10.8951C21.1272 11.1816 21.4853 11.3248 21.9354 11.3248C22.3309 11.3248 22.6481 11.2396 22.8868 11.0691C23.1323 10.8917 23.313 10.6735 23.429 10.4143L23.8689 10.6803C23.8075 10.8576 23.7154 11.0315 23.5927 11.202C23.4767 11.3726 23.3301 11.526 23.1528 11.6624C22.9754 11.7988 22.7674 11.9113 22.5287 12C22.29 12.0818 22.0172 12.1228 21.7103 12.1228ZM20.4622 8.78774H22.7947V8.6752C22.7947 8.18416 22.6992 7.80564 22.5083 7.53966C22.3241 7.26685 22.0377 7.13045 21.6489 7.13045C21.267 7.13045 20.9737 7.26344 20.7691 7.52943C20.5645 7.78859 20.4622 8.1637 20.4622 8.65474V8.78774ZM24.2257 11.4476H24.9213V7.49874L24.2257 7.36575V6.91562L26.0364 6.55756V7.50897H26.0875C26.1353 7.38621 26.1932 7.27026 26.2614 7.16114C26.3365 7.0452 26.4251 6.9429 26.5274 6.85424C26.6366 6.76558 26.7593 6.69397 26.8957 6.6394C27.0389 6.58484 27.1992 6.55756 27.3765 6.55756C27.6903 6.55756 27.9392 6.636 28.1233 6.79286C28.3143 6.94972 28.4098 7.17478 28.4098 7.46805C28.4098 7.69993 28.3484 7.88407 28.2256 8.02047C28.1097 8.15006 27.9494 8.21485 27.7448 8.21485C27.5334 8.21485 27.3663 8.16029 27.2435 8.05116C27.1276 7.93522 27.0696 7.792 27.0696 7.6215C27.0696 7.50556 27.0935 7.41008 27.1412 7.33505C27.189 7.25321 27.247 7.20547 27.3152 7.19183V7.16114C27.2947 7.15432 27.2708 7.15091 27.2435 7.15091C27.2163 7.14409 27.1753 7.14068 27.1208 7.14068C26.9912 7.14068 26.8616 7.17478 26.732 7.24298C26.6093 7.31118 26.4967 7.39985 26.3944 7.50897C26.299 7.61127 26.2205 7.73062 26.1591 7.86702C26.0978 7.9966 26.0671 8.12619 26.0671 8.25577V11.4476H26.9673V12H24.2257V11.4476ZM30.8227 12.1228C30.4272 12.1228 30.0759 12.058 29.769 11.9284C29.4621 11.792 29.203 11.601 28.9915 11.3555C28.7801 11.11 28.6164 10.8167 28.5005 10.4757C28.3914 10.1347 28.3368 9.75619 28.3368 9.34016C28.3368 8.91732 28.3948 8.53539 28.5107 8.19439C28.6335 7.85338 28.8006 7.56353 29.012 7.32482C29.2302 7.0793 29.486 6.89175 29.7793 6.76217C30.0793 6.62576 30.4067 6.55756 30.7614 6.55756C31.1228 6.55756 31.4468 6.61894 31.7332 6.74171C32.0197 6.85765 32.2618 7.02474 32.4596 7.24298C32.6642 7.46123 32.821 7.7238 32.9301 8.0307C33.0393 8.33761 33.0938 8.67861 33.0938 9.05372V9.32993H29.5747V9.6573C29.5747 10.1893 29.7076 10.6019 29.9736 10.8951C30.2396 11.1816 30.5977 11.3248 31.0478 11.3248C31.4434 11.3248 31.7605 11.2396 31.9992 11.0691C32.2447 10.8917 32.4255 10.6735 32.5414 10.4143L32.9813 10.6803C32.9199 10.8576 32.8278 11.0315 32.7051 11.202C32.5891 11.3726 32.4425 11.526 32.2652 11.6624C32.0879 11.7988 31.8798 11.9113 31.6411 12C31.4024 12.0818 31.1296 12.1228 30.8227 12.1228ZM29.5747 8.78774H31.9071V8.6752C31.9071 8.18416 31.8116 7.80564 31.6207 7.53966C31.4365 7.26685 31.1501 7.13045 30.7614 7.13045C30.3794 7.13045 30.0862 7.26344 29.8816 7.52943C29.677 7.78859 29.5747 8.1637 29.5747 8.65474V8.78774ZM35.597 12.1228C35.2696 12.1228 34.973 12.0614 34.707 11.9386C34.441 11.809 34.2159 11.6249 34.0318 11.3862C33.8477 11.1475 33.7044 10.8576 33.6021 10.5166C33.4998 10.1688 33.4487 9.77665 33.4487 9.34016C33.4487 8.90368 33.4998 8.51493 33.6021 8.17393C33.7044 7.8261 33.8477 7.53284 34.0318 7.29413C34.2159 7.05543 34.441 6.8747 34.707 6.75194C34.973 6.62235 35.2696 6.55756 35.597 6.55756C35.9994 6.55756 36.3199 6.64964 36.5586 6.83378C36.8042 7.01792 36.9815 7.23275 37.0906 7.47828H37.1418V5.16626L36.4461 5.03327V4.58315L38.2875 4.22509V11.1816L38.9832 11.3146V11.7647L37.1418 12.1228V11.202H37.0906C36.9815 11.4476 36.8042 11.6624 36.5586 11.8465C36.3131 12.0307 35.9926 12.1228 35.597 12.1228ZM35.9551 11.3862C36.1051 11.3862 36.2517 11.3657 36.395 11.3248C36.5382 11.2771 36.6644 11.2089 36.7735 11.1202C36.8894 11.0315 36.9781 10.9258 37.0395 10.8031C37.1077 10.6803 37.1418 10.5405 37.1418 10.3836V8.29669C37.1418 8.13983 37.1077 8.00001 37.0395 7.87725C36.9781 7.75449 36.8894 7.64878 36.7735 7.56012C36.6644 7.47146 36.5382 7.40667 36.395 7.36575C36.2517 7.318 36.1051 7.29413 35.9551 7.29413C35.5663 7.29413 35.256 7.42713 35.0241 7.69311C34.7922 7.95909 34.6763 8.32738 34.6763 8.79797V9.88236C34.6763 10.3529 34.7922 10.7212 35.0241 10.9872C35.256 11.2532 35.5663 11.3862 35.9551 11.3862ZM44.0631 12.1228C43.6402 12.1228 43.2992 12.0307 43.0401 11.8465C42.7877 11.6624 42.607 11.4476 42.4979 11.202H42.4467L41.8738 12H41.3726V5.16626L40.6769 5.03327V4.58315L42.5183 4.22509V7.47828H42.5695C42.6786 7.23275 42.8559 7.01792 43.1015 6.83378C43.347 6.64964 43.6675 6.55756 44.0631 6.55756C44.3905 6.55756 44.6871 6.62235 44.9531 6.75194C45.2191 6.8747 45.4442 7.05543 45.6283 7.29413C45.8124 7.53284 45.9557 7.8261 46.058 8.17393C46.1603 8.51493 46.2114 8.90368 46.2114 9.34016C46.2114 9.77665 46.1603 10.1688 46.058 10.5166C45.9557 10.8576 45.8124 11.1475 45.6283 11.3862C45.4442 11.6249 45.2191 11.809 44.9531 11.9386C44.6871 12.0614 44.3905 12.1228 44.0631 12.1228ZM43.705 11.3862C44.0938 11.3862 44.4041 11.2532 44.636 10.9872C44.8679 10.7212 44.9838 10.3529 44.9838 9.88236V8.79797C44.9838 8.32738 44.8679 7.95909 44.636 7.69311C44.4041 7.42713 44.0938 7.29413 43.705 7.29413C43.5482 7.29413 43.3981 7.318 43.2549 7.36575C43.1185 7.40667 42.9923 7.47146 42.8764 7.56012C42.7673 7.64878 42.6786 7.75449 42.6104 7.87725C42.549 8.00001 42.5183 8.13983 42.5183 8.29669V10.3836C42.5183 10.5405 42.549 10.6803 42.6104 10.8031C42.6786 10.9258 42.7673 11.0315 42.8764 11.1202C42.9923 11.2089 43.1185 11.2771 43.2549 11.3248C43.3981 11.3657 43.5482 11.3862 43.705 11.3862ZM47.2604 14.1688C46.8921 14.1688 46.6125 14.0835 46.4215 13.913C46.2374 13.7425 46.1453 13.5311 46.1453 13.2788C46.1453 13.0673 46.1999 12.9003 46.309 12.7775C46.425 12.6615 46.5852 12.6036 46.7898 12.6036C46.9808 12.6036 47.1274 12.6615 47.2297 12.7775C47.3388 12.8934 47.3934 13.0401 47.3934 13.2174C47.3934 13.3197 47.3695 13.4083 47.3218 13.4834C47.2809 13.5652 47.2331 13.6232 47.1786 13.6573V13.6982C47.2127 13.7118 47.2434 13.7187 47.2706 13.7187C47.3047 13.7187 47.3457 13.7187 47.3934 13.7187C47.7617 13.7187 48.0788 13.3742 48.3448 12.6854L48.5085 12.2353L46.5648 7.23275H46.0533V6.68033H48.4778V7.23275H47.7924L49.0609 10.7826H49.1121L50.3704 7.23275H49.6952V6.68033H51.5673V7.23275H51.0558L48.9177 12.7366C48.8427 12.9207 48.754 13.098 48.6517 13.2685C48.5562 13.4459 48.4403 13.5993 48.3039 13.7289C48.1743 13.8653 48.0243 13.971 47.8538 14.046C47.6833 14.1279 47.4855 14.1688 47.2604 14.1688ZM52.5065 12.1228C52.2678 12.1228 52.0802 12.0512 51.9438 11.9079C51.8142 11.7647 51.7494 11.5942 51.7494 11.3964V11.335C51.7494 11.1373 51.8142 10.9668 51.9438 10.8235C52.0802 10.6803 52.2678 10.6087 52.5065 10.6087C52.7452 10.6087 52.9293 10.6803 53.0589 10.8235C53.1953 10.9668 53.2635 11.1373 53.2635 11.335V11.3964C53.2635 11.5942 53.1953 11.7647 53.0589 11.9079C52.9293 12.0512 52.7452 12.1228 52.5065 12.1228ZM52.5065 8.07163C52.2678 8.07163 52.0802 8.00001 51.9438 7.85679C51.8142 7.71357 51.7494 7.54307 51.7494 7.34528V7.2839C51.7494 7.08612 51.8142 6.91562 51.9438 6.7724C52.0802 6.62917 52.2678 6.55756 52.5065 6.55756C52.7452 6.55756 52.9293 6.62917 53.0589 6.7724C53.1953 6.91562 53.2635 7.08612 53.2635 7.2839V7.34528C53.2635 7.54307 53.1953 7.71357 53.0589 7.85679C52.9293 8.00001 52.7452 8.07163 52.5065 8.07163Z"
                  fill="black"/>
              <path
                  d="M65.6177 4.81001L66.5537 5.84032C66.6336 5.92807 66.7796 5.8716 66.7796 5.75345V3.28625C66.7796 3.25184 66.7932 3.21882 66.8175 3.19441C66.8417 3.17 66.8746 3.15617 66.909 3.15594H68.6291C69.3841 3.15594 70.0834 3.55034 70.4704 4.19408L70.8101 4.75875C70.8327 4.79619 70.8645 4.82718 70.9025 4.84871C70.9406 4.87025 70.9835 4.8816 71.0273 4.88168H71.0403C71.1076 4.88156 71.1721 4.85474 71.2197 4.8071C71.2673 4.75946 71.294 4.69489 71.294 4.62757V2.06134C71.294 1.99402 71.2673 1.92945 71.2197 1.88181C71.1721 1.83417 71.1076 1.80735 71.0403 1.80723H67.0389C66.9701 1.80723 66.9042 1.77991 66.8555 1.73128C66.8069 1.68265 66.7796 1.61669 66.7796 1.54791V0.375993C66.7796 0.268704 66.6927 0.181396 66.585 0.181396H65.6776C65.5703 0.181396 65.483 0.26827 65.483 0.375993V1.54791C65.483 1.69125 65.367 1.80766 65.2237 1.80766H60.2545C60.1873 1.80766 60.1228 1.83432 60.0752 1.88178C60.0275 1.92925 60.0007 1.99366 60.0004 2.0609V2.66641C60.0004 2.73156 60.0256 2.79411 60.0704 2.84146L65.6463 7.82538C65.6909 7.87242 65.7157 7.93476 65.7157 7.99956C65.7157 8.06436 65.6909 8.1267 65.6463 8.17374L60.0699 13.1581C60.0251 13.2053 60 13.268 60 13.3331V13.9387C60 14.079 60.1138 14.1923 60.2541 14.1923H65.2233C65.3666 14.1923 65.4826 14.3087 65.4826 14.4521V15.624C65.4826 15.7313 65.5694 15.8186 65.6772 15.8186H66.5846C66.6919 15.8186 66.7792 15.7317 66.7792 15.624V14.4521C66.7792 14.3087 66.8951 14.1928 67.038 14.1928H71.0394C71.0729 14.1928 71.1061 14.1863 71.137 14.1735C71.1679 14.1607 71.196 14.1419 71.2197 14.1182C71.2433 14.0945 71.2621 14.0664 71.2748 14.0354C71.2876 14.0044 71.2941 13.9713 71.294 13.9378V11.372C71.294 11.3046 71.2672 11.24 71.2195 11.1923C71.1719 11.1446 71.1073 11.1179 71.0399 11.1179H71.0277C70.9838 11.1178 70.9407 11.1291 70.9025 11.1506C70.8643 11.1722 70.8323 11.2032 70.8096 11.2408L70.4704 11.8055C70.2791 12.1226 70.0091 12.3848 69.6865 12.5667C69.364 12.7486 68.9999 12.844 68.6296 12.8436H66.909C66.892 12.8436 66.8751 12.8401 66.8594 12.8336C66.8436 12.827 66.8293 12.8174 66.8173 12.8053C66.8053 12.7932 66.7958 12.7788 66.7893 12.763C66.7828 12.7473 66.7795 12.7304 66.7796 12.7133V10.2461C66.7797 10.2199 66.7718 10.1942 66.757 10.1725C66.7422 10.1508 66.7211 10.1342 66.6966 10.1248C66.6721 10.1153 66.6453 10.1136 66.6198 10.1197C66.5943 10.1259 66.5712 10.1397 66.5537 10.1592L65.6177 11.1895C65.5308 11.2851 65.483 11.4093 65.483 11.5388V12.7137C65.483 12.7481 65.4694 12.781 65.4451 12.8053C65.4208 12.8295 65.3879 12.8432 65.3536 12.8432H62.1636C62.1563 12.8434 62.1491 12.8417 62.1427 12.8383C62.1363 12.8348 62.1309 12.8298 62.1271 12.8236C62.1228 12.8164 62.1209 12.808 62.1216 12.7996C62.1223 12.7912 62.1256 12.7832 62.131 12.7767L67.1015 8.10598L67.1023 8.10468C67.1265 8.07489 67.1397 8.0377 67.1397 7.99934C67.1397 7.96099 67.1265 7.9238 67.1023 7.89401L67.1015 7.89314L62.131 3.22283C62.1256 3.21637 62.1223 3.20839 62.1216 3.2C62.1209 3.1916 62.1228 3.18319 62.1271 3.17592C62.1309 3.16977 62.1363 3.16473 62.1427 3.1613C62.1491 3.15787 62.1563 3.15617 62.1636 3.15637H65.3536C65.4248 3.15637 65.483 3.21414 65.483 3.28581V4.46078C65.483 4.58978 65.5308 4.71445 65.6177 4.81001Z"
                  fill="#FF5500"/>
              <path
                  d="M75.9416 13V2.7897H77.5752L79.6902 7.39892L81.8052 2.7897H83.4388V13H81.9656V5.7361L80.3028 9.38264H79.0776L77.4148 5.75069V13H75.9416ZM85.0084 13V11.6289H87.2255V4.1608H85.0376V2.7897H90.9596V4.1608H88.7717V11.6289H90.9888V13H85.0084ZM92.7626 13V2.7897H95.213C96.8564 2.7897 98.0768 3.24674 98.8742 4.1608C99.6715 5.06514 100.07 6.30983 100.07 7.89485C100.07 9.47988 99.6715 10.7294 98.8742 11.6435C98.0768 12.5478 96.8564 13 95.213 13H92.7626ZM94.3087 11.5706H95.1547C96.341 11.5706 97.1968 11.2399 97.7219 10.5787C98.247 9.90774 98.5095 9.01312 98.5095 7.89485C98.5095 6.77658 98.247 5.88683 97.7219 5.22559C97.1968 4.55463 96.341 4.21914 95.1547 4.21914H94.3087V11.5706ZM101.406 13V2.7897H107.926V4.17539H102.953V7.15096H107.489V8.52206H102.953V11.6143H107.926V13H101.406ZM109.292 13V2.7897H110.809L115.083 10.2724V2.7897H116.556V13H115.039L110.765 5.51731V13H109.292Z"
                  fill="black"/>
            </svg>
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
