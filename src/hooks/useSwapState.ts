import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { AccountId } from '@demox-labs/miden-sdk';
import { NablaAntennaContext } from '@/components/PriceFetcher';
import { useBalance } from '@/hooks/useBalance';
import { initializeTokenConfig, TOKENS, type TokenSymbol, UI } from '@/lib/config';
import {
  getBalanceValidation,
  type TokenPriceData,
} from '@/lib/swapHelpers';

export interface SwapState {
  readonly sellAmount: string;
  readonly buyAmount: string;
  readonly sellToken: TokenSymbol | undefined;
  readonly buyToken: TokenSymbol | undefined;
  readonly slippage: number;
  readonly lastEditedField: 'sell' | 'buy';
  readonly isFetchingQuote: boolean;
  readonly isSwappingTokens: boolean;
}

export interface SwapActions {
  readonly setSellAmount: (amount: string) => void;
  readonly setBuyAmount: (amount: string) => void;
  readonly setSellToken: (token: TokenSymbol | undefined) => void;
  readonly setBuyToken: (token: TokenSymbol | undefined) => void;
  readonly setSlippage: (slippage: number) => void;
  readonly handleSellAmountChange: (value: string) => void;
  readonly handleBuyAmountChange: (value: string) => void;
  readonly handleReplaceTokens: () => void;
  readonly handleMaxClick: () => void;
}

export interface SwapData {
  readonly tokenData: TokenPriceData;
  readonly balanceValidation: ReturnType<typeof getBalanceValidation>;
  readonly canSwap: boolean;
  readonly sellBalance: bigint | null;
  readonly buyBalance: bigint | null;
  readonly sellBalanceLoading: boolean;
  readonly buyBalanceLoading: boolean;
  readonly formattedSellBalance: string;
  readonly formattedBuyBalance: string;
  readonly connected: boolean;
  readonly stableUserAccountId: string | undefined;
}

/**
 * Centralized swap state management hook
 */
export const useSwapState = () => {
  // Core state
  const [sellAmount, setSellAmount] = useState<string>('');
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [sellToken, setSellToken] = useState<TokenSymbol | undefined>(undefined);
  const [buyToken, setBuyToken] = useState<TokenSymbol | undefined>(undefined);
  const [slippage, setSlippage] = useState<number>(UI.defaultSlippage);
  const [lastEditedField, setLastEditedField] = useState<'sell' | 'buy'>('sell');
  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);
  const [isSwappingTokens, setIsSwappingTokens] = useState<boolean>(false);

  // Loading states
  const [tokensLoaded, setTokensLoaded] = useState<boolean>(false);
  const [availableTokens, setAvailableTokens] = useState<TokenSymbol[]>([]);
  const [pricesFetched, setPricesFetched] = useState<boolean>(false);

  // Wallet connection
  const { connected, wallet } = useWallet();
  const { refreshPrices } = useContext(NablaAntennaContext);

  // Refs for stable calculations
  const debounceRef = useRef<NodeJS.Timeout>();
  const sellInputRef = useRef<HTMLInputElement>(null);

  // Stable user account ID
  const stableUserAccountId = useMemo(() => {
    return wallet?.adapter?.accountId;
  }, [wallet?.adapter?.accountId]);

  // Balance parameters
  const sellBalanceParams = useMemo(() => ({
    accountId: stableUserAccountId ? AccountId.fromBech32(stableUserAccountId) : null,
    faucetId: sellToken && TOKENS[sellToken]
      ? AccountId.fromBech32(TOKENS[sellToken].faucetId)
      : undefined,
  }), [stableUserAccountId, sellToken]);

  const buyBalanceParams = useMemo(() => ({
    accountId: stableUserAccountId ? AccountId.fromBech32(stableUserAccountId) : null,
    faucetId: buyToken && TOKENS[buyToken]
      ? AccountId.fromBech32(TOKENS[buyToken].faucetId)
      : undefined,
  }), [stableUserAccountId, buyToken]);

  // Balance hooks
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

  return {
    state: {
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
    },
    actions: {
      setSellAmount,
      setBuyAmount,
      setSellToken,
      setBuyToken,
      setSlippage,
      setLastEditedField,
      setIsFetchingQuote,
      setIsSwappingTokens,
      setTokensLoaded,
      setAvailableTokens,
      setPricesFetched,
    },
    balances: {
      sellBalance,
      buyBalance,
      sellBalanceLoading,
      buyBalanceLoading,
      refreshSellBalance,
      refreshBuyBalance,
    },
    refs: {
      debounceRef,
      sellInputRef,
    },
    wallet: {
      connected,
      stableUserAccountId,
    },
    context: {
      refreshPrices,
    },
  };
};

/**
 * Token initialization hook
 */
export const useTokenInitialization = (
  setTokensLoaded: (loaded: boolean) => void,
  setAvailableTokens: (tokens: TokenSymbol[]) => void,
  setSellToken: (token: TokenSymbol | undefined) => void,
  setBuyToken: (token: TokenSymbol | undefined) => void,
) => {
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
};

/**
 * Auto-refetch hook for prices and balances
 */
export const useAutoRefetch = (
  refreshCallback: () => Promise<void>,
  dependencies: readonly unknown[],
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