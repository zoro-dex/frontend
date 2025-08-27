import { NablaAntennaContext } from '@/components/PriceFetcher';
import { useBalance } from '@/hooks/useBalance';
import {
  initializeTokenConfig,
  poolAccountId,
  TOKENS,
  type TokenSymbol,
  UI,
} from '@/lib/config';
import { getBalanceValidation, type TokenPriceData } from '@/lib/swapHelpers';
import { AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';

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

const instantiateClient = async (
  { accountsToImport }: { accountsToImport: AccountId[] },
) => {
  const { WebClient } = await import(
    '@demox-labs/miden-sdk'
  );
  const nodeEndpoint = 'https://rpc.testnet.miden.io:443';
  const client = await WebClient.createClient(nodeEndpoint);
  for (const acc of accountsToImport) {
    try {
      await client.importAccountById(acc);
    } catch {}
  }
  await client.syncState();
  return client;
};

/**
 * Centralized swap state management hook
 */
export const useSwapState = () => {
  // Core state
  const [client, setClient] = useState<WebClient | undefined>(undefined);
  const [sellAmount, setSellAmount] = useState<string>('');
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [sellToken, setSellToken] = useState<TokenSymbol | undefined>(undefined);
  const [buyToken, setBuyToken] = useState<TokenSymbol | undefined>(undefined);
  const [slippage, setSlippage] = useState<number>(UI.defaultSlippage);
  const [lastEditedField, setLastEditedField] = useState<'sell' | 'buy'>('sell');
  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);
  const [isSwappingTokens, setIsSwappingTokens] = useState<boolean>(false);
  const { accountId: rawAccountId } = useWallet();

  const accountId = useMemo(() => {
    if (rawAccountId != null) {
      return AccountId.fromBech32(rawAccountId);
    } else return undefined;
  }, [rawAccountId]);

  // Loading states
  const [tokensLoaded, setTokensLoaded] = useState<boolean>(false);
  const [availableTokens, setAvailableTokens] = useState<TokenSymbol[]>([]);
  const [pricesFetched, setPricesFetched] = useState<boolean>(false);

  const { refreshPrices } = useContext(NablaAntennaContext);

  // Refs for stable calculations
  const debounceRef = useRef<NodeJS.Timeout>();
  const sellInputRef = useRef<HTMLInputElement>(null);

  // Balance parameters
  const sellBalanceParams = useMemo(() => ({
    accountId,
    faucetId: sellToken && TOKENS[sellToken]
      ? AccountId.fromBech32(TOKENS[sellToken].faucetId)
      : undefined,
  }), [accountId, sellToken]);

  const buyBalanceParams = useMemo(() => ({
    accountId,
    faucetId: buyToken && TOKENS[buyToken]
      ? AccountId.fromBech32(TOKENS[buyToken].faucetId)
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
            sellBalanceParams.faucetId as AccountId,
            buyBalanceParams.faucetId as AccountId,
            poolAccountId,
          ],
        });
        setClient(client);
      })();
    }
  }, [accountId, sellBalanceParams.faucetId, buyBalanceParams.faucetId]);

  // Balance hooks
  const {
    balance: sellBalance,
    refreshBalance: refreshSellBalance,
  } = useBalance({
    accountId,
    faucetId: sellBalanceParams.faucetId,
    client,
  });

  const {
    balance: buyBalance,
    refreshBalance: refreshBuyBalance,
  } = useBalance({
    accountId,
    faucetId: buyBalanceParams.faucetId,
    client,
  });

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
      sellBalanceLoading: false,
      buyBalanceLoading: false,
      refreshSellBalance,
      refreshBuyBalance,
    },
    refs: {
      debounceRef,
      sellInputRef,
    },
    context: {
      refreshPrices,
    },
    accountId,
    client,
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
