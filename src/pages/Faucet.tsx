import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { initializeTokenConfig, TOKENS, type TokenSymbol } from '@/lib/config';
import { type FaucetMintResult, mintFromFaucet } from '@/services/faucet';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton"
import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';

interface MintStatus {
  readonly isLoading: boolean;
  readonly lastResult: FaucetMintResult | null;
  readonly lastAttempt: number;
  readonly showMessage: boolean;
}

type TokenMintStatuses = Record<TokenSymbol, MintStatus>;

function Faucet() {
  const { wallet, connected } = useWallet();
  const [tokensLoaded, setTokensLoaded] = useState<boolean>(false);
  const [availableTokens, setAvailableTokens] = useState<TokenSymbol[]>([]);
  const [mintStatuses, setMintStatuses] = useState<TokenMintStatuses>({} as TokenMintStatuses);

  useEffect(() => {
    const loadTokens = async (): Promise<void> => {
      try {
        await initializeTokenConfig();
        const tokenSymbols = Object.keys(TOKENS) as TokenSymbol[];
        setAvailableTokens(tokenSymbols);

        const initialStatuses: Partial<TokenMintStatuses> = {};
        for (const symbol of tokenSymbols) {
          initialStatuses[symbol] = {
            isLoading: false,
            lastResult: null,
            lastAttempt: 0,
            showMessage: false,
          };
        }
        setMintStatuses(initialStatuses as TokenMintStatuses);
        setTokensLoaded(true);
      } catch (error) {
        setTokensLoaded(true);
      }
    };

    loadTokens();
  }, []);

  const updateMintStatus = useCallback((
    tokenSymbol: TokenSymbol,
    updates: Partial<MintStatus>,
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
      return;
    }

    const token = TOKENS[tokenSymbol];
    if (!token) {
      return;
    }

    const accountId = wallet.adapter.accountId;
    const faucetId = token.faucetId;

    updateMintStatus(tokenSymbol, {
      isLoading: true,
      lastAttempt: Date.now(),
      showMessage: false,
    });

    try {
      const result = await mintFromFaucet(accountId, faucetId);

      updateMintStatus(tokenSymbol, {
        isLoading: false,
        lastResult: result,
        showMessage: false,
      });

      setTimeout(() => {
        updateMintStatus(tokenSymbol, {
          showMessage: true,
        });
      }, 100);

      setTimeout(() => {
        updateMintStatus(tokenSymbol, {
          showMessage: false,
        });
      }, 5100);

    } catch (error) {
      const errorResult: FaucetMintResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };

      updateMintStatus(tokenSymbol, {
        isLoading: false,
        lastResult: errorResult,
        showMessage: false,
      });

      setTimeout(() => {
        updateMintStatus(tokenSymbol, {
          showMessage: true,
        });
      }, 100);

      setTimeout(() => {
        updateMintStatus(tokenSymbol, {
          showMessage: false,
        });
      }, 5100);
    }
  }, [connected, wallet?.adapter?.accountId, updateMintStatus]);

  const getStatusIcon = (status: MintStatus): React.ReactNode => {
    if (status.isLoading) {
      return <Loader2 className='w-4 h-4 animate-spin text-blue-500' />;
    }

    return null;
  };

  const getButtonText = (tokenSymbol: TokenSymbol, status: MintStatus): string => {
      return status.isLoading ? `Minting ${tokenSymbol}...` : `Request ${tokenSymbol}`;
  };

  const isButtonDisabled = (status: MintStatus): boolean => {
    return status.isLoading || !connected;
  };

  if (!tokensLoaded) 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-5">
        <div className="flex flex-col">
          <Skeleton className="h-[160px] w-[350px] rounded-xl transition-all duration-400 ease-out opacity-20 border-2 border-teal-200 dark:border-teal-600/75" />
        </div>
        <div className="flex flex-col">
          <Skeleton className="h-[160px] w-[350px] rounded-xl mb-8 transition-all duration-400 ease-out opacity-20 border-2 border-teal-200 dark:border-teal-600/75" />
        </div>
      </div>
    );

  if (availableTokens.length === 0) {
    return (
      <div className='min-h-screen bg-background text-foreground flex flex-col'>
        <Header />
        <main className='flex-1 flex items-center justify-center'>
          <div className='text-center space-y-4'>
            <div className='text-destructive'>No faucets available</div>
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
      <Header />
      <main className='flex-1 flex items-center justify-center p-3'>
        <div className='w-full max-w-sm sm:max-w-md space-y-4'>
          <div className='space-y-4'>
            {availableTokens.map((tokenSymbol) => {
              const token = TOKENS[tokenSymbol];
              const status = mintStatuses[tokenSymbol];

              if (!token || !status) return null;

              return (
                <Card
                  key={tokenSymbol}
                  className='rounded-xl hover:shadow-lg transition-all duration-200'
                >
                  <CardContent className='p-4 sm:p-6'>
                    <div className='flex items-center gap-4 mb-4'>
                      <img
                        src={token.icon}
                        alt={token.name}
                        className={`w-10 h-10 sm:w-12 sm:h-12 ${token.iconClass || ''}`}
                      />
                      <div className='flex-1'>
                        <h3 className='text-lg sm:text-xl font-semibold'>
                          Test {token.name}
                        </h3>
                        <div className='text-xs text-muted-foreground font-mono overflow-hidden'>
                          <span className='hidden sm:inline'>{token.faucetId}</span>
                          <span className='sm:hidden break-all'>{token.faucetId}</span>
                        </div>
                      </div>
                      {getStatusIcon(status)}
                    </div>

                    <div className='space-y-3'>
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                          status.lastResult && status.showMessage 
                            ? 'max-h-20 opacity-100 mb-3' 
                            : 'max-h-0 opacity-0 mb-0'
                        }`}
                      >
                        {status.lastResult && (
                          <div
                            className={`text-xs p-2 rounded-md transform transition-all duration-300 ease-out ${
                              status.showMessage 
                                ? 'translate-y-0 scale-100' 
                                : '-translate-y-2 scale-95'
                            } ${
                              status.lastResult.success
                                ? 'bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-200'
                                : 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200'
                            }`}
                          >
                            {status.lastResult.message}
                            {status.lastResult.transactionId && (
                              <div className='mt-1 font-mono text-xs opacity-75 break-all'>
                                TX: {status.lastResult.transactionId}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {connected && (
                        <Button
                          onClick={() => requestTokens(tokenSymbol)}
                          disabled={isButtonDisabled(status)}
                          className='w-full bg-teal-800 hover:bg-teal-900 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {status.isLoading && (
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          )}
                          {getButtonText(tokenSymbol, status)}
                        </Button>
                      )}
                      {!connected && (
                        <WalletMultiButton className='!p-5 !w-full !h-full !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !text-muted-foreground animate-pulse hover:!text-foreground hover:!bg-gray-500/10 !text-center !flex !items-center !justify-center'>
                          Connect
                        </WalletMultiButton>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className='text-center'>
            <Link to='/'>
              <Button
                variant='ghost'
                size='sm'
                className='text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors'
              >
                ← Back to Zoro
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default Faucet;