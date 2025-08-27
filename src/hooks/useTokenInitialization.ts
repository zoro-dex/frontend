import { initializeTokenConfig, TOKENS, type TokenSymbol } from '@/lib/config';
import { useEffect } from 'react';

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
