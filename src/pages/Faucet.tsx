import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { mintFromFaucet, type FaucetMintResult } from '@/lib/faucetService';
import { TOKENS, initializeTokenConfig, type TokenSymbol } from '@/lib/config';

interface MintStatus {
  readonly isLoading: boolean;
  readonly lastResult: FaucetMintResult | null;
  readonly lastAttempt: number;
}

type TokenMintStatuses = Record<TokenSymbol, MintStatus>;

function Faucet(): JSX.Element {
  const { wallet, connected } = useWallet();
  const [tokensLoaded, setTokensLoaded] = useState<boolean>(false);
  const [availableTokens, setAvailableTokens] = useState<TokenSymbol[]>([]);
  const [mintStatuses, setMintStatuses] = useState<TokenMintStatuses>({} as TokenMintStatuses);

  // Initialize tokens and set up available tokens list
  useEffect(() => {
    const loadTokens = async (): Promise<void> => {
      try {
        await initializeTokenConfig();
        const tokenSymbols = Object.keys(TOKENS) as TokenSymbol[];
        setAvailableTokens(tokenSymbols);
        
        // Initialize mint statuses for each token
        const initialStatuses: TokenMintStatuses = {} as TokenMintStatuses;
        for (const symbol of tokenSymbols) {
          initialStatuses[symbol] = {
            isLoading: false,
            lastResult: null,
            lastAttempt: 0,
          };
        }
        setMintStatuses(initialStatuses);
        
        setTokensLoaded(true);
        console.log('Available tokens for faucet:', tokenSymbols);
      } catch (error) {
        console.error('Failed to initialize tokens:', error);
        setTokensLoaded(true); // Still set to true to show error state
      }
    };

    loadTokens();
  }, []);

  const updateMintStatus = useCallback((
    tokenSymbol: TokenSymbol,
    updates: Partial<MintStatus>
  ): void => {
    setMintStatuses(prev => ({
      ...prev,
      [tokenSymbol]: {
        ...prev[tokenSymbol],
        ...updates,
      },
    }));
  }, []);

  const requestTokens = useCallback(async (tokenSymbol: TokenSymbol): Promise<void> => {
    if (!connected || !wallet?.adapter?.accountId) {
      console.error('Wallet not connected');
      return;
    }

    const token = TOKENS[tokenSymbol];
    if (!token) {
      console.error(`Token configuration not found for ${tokenSymbol}`);
      return;
    }

    const accountId = wallet.adapter.accountId;
    const faucetId = token.faucetId;

    console.log(`🚰 Requesting ${tokenSymbol} for account: ${accountId}`);
    console.log(`🏭 Using faucet: ${faucetId}`);

    // Set loading state
    updateMintStatus(tokenSymbol, {
      isLoading: true,
      lastAttempt: Date.now(),
    });

    try {
      const result = await mintFromFaucet(accountId, faucetId);
      
      updateMintStatus(tokenSymbol, {
        isLoading: false,
        lastResult: result,
      });

      if (result.success) {
        console.log(`✅ Successfully minted ${tokenSymbol}:`, result.message);
        if (result.transactionId) {
          console.log(`📋 Transaction ID: ${result.transactionId}`);
        }
      } else {
        console.error(`❌ Failed to mint ${tokenSymbol}:`, result.message);
      }
    } catch (error) {
      console.error(`💥 Mint request failed for ${tokenSymbol}:`, error);
      
      updateMintStatus(tokenSymbol, {
        isLoading: false,
        lastResult: {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }, [connected, wallet?.adapter?.accountId, updateMintStatus]);

  const getStatusIcon = (status: MintStatus): React.ReactNode => {
    if (status.isLoading) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    
    if (!status.lastResult) {
      return null;
    }
    
    if (status.lastResult.success) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getButtonText = (tokenSymbol: TokenSymbol, status: MintStatus): string => {
    if (status.isLoading) {
      return `Minting ${tokenSymbol}...`;
    }
    
    return `Request ${tokenSymbol}`;
  };

  const isButtonDisabled = (status: MintStatus): boolean => {
    return status.isLoading || !connected;
  };

  // Show loading state while tokens are being fetched
  if (!tokensLoaded) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading faucet configuration...</span>
          </div>
        </main>
      </div>
    );
  }

  // Show error state if no tokens are available
  if (availableTokens.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-destructive">No faucets available</div>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6">
          
          {/* Connection Status */}
          {!connected && (
            <Card className="rounded-xl border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="p-4 text-center">
                <div className="text-amber-800 dark:text-amber-200 text-sm">
                  Connect your wallet to request test tokens
                </div>
              </CardContent>
            </Card>
          )}

          {/* Faucet Cards */}
          <div className="space-y-4">
            {availableTokens.map((tokenSymbol) => {
              const token = TOKENS[tokenSymbol];
              const status = mintStatuses[tokenSymbol];
              
              if (!token || !status) return null;

              return (
                <Card key={tokenSymbol} className="rounded-xl hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <img 
                        src={token.icon} 
                        alt={token.name} 
                        className={`w-10 h-10 sm:w-12 sm:h-12 ${token.iconClass || ''}`}
                      />
                      <div className="flex-1">
                        <h3 className="text-lg sm:text-xl font-semibold">Test {token.name}</h3>
                        <div className="text-xs text-muted-foreground font-mono">
                          {token.faucetId}
                        </div>
                      </div>
                      {getStatusIcon(status)}
                    </div>
                    
                    <div className="space-y-3">
                      {/* Status Message */}
                      {status.lastResult && (
                        <div className={`text-xs p-2 rounded-md ${
                          status.lastResult.success 
                            ? 'bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-200' 
                            : 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200'
                        }`}>
                          {status.lastResult.message}
                          {status.lastResult.transactionId && (
                            <div className="mt-1 font-mono text-xs opacity-75">
                              TX: {status.lastResult.transactionId}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <Button 
                        onClick={() => requestTokens(tokenSymbol)}
                        disabled={isButtonDisabled(status)}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        variant="ghost"
                      >
                        {status.isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {getButtonText(tokenSymbol, status)}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Back to App */}
          <div className="text-center">
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to Zoro AMM
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Faucet;