import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { accountIdToBech32 } from '@/lib/utils';
import { ZoroContext } from '@/providers/ZoroContext';
import { type FaucetMintResult, mintFromFaucet } from '@/services/faucet';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { Loader2 } from 'lucide-react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface MintStatus {
  readonly isLoading: boolean;
  readonly lastResult: FaucetMintResult | null;
  readonly lastAttempt: number;
  readonly showMessage: boolean;
}

type TokenMintStatuses = Record<string, MintStatus>;

function Faucet() {
  const { connected } = useWallet();
  const [mintStatuses, setMintStatuses] = useState<TokenMintStatuses>(
    {} as TokenMintStatuses,
  );
  const { tokens, tokensLoading, accountId } = useContext(ZoroContext);
  const updateMintStatus = useCallback((
    tokenSymbol: string,
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

  useEffect(() => {
    for (const token of Object.values(tokens)) {
      // init token states
      if (!mintStatuses[token.symbol]) {
        updateMintStatus(token.symbol, {
          isLoading: false,
          lastAttempt: 0,
          lastResult: null,
          showMessage: false,
        });
      }
    }
  }, [tokens, mintStatuses, setMintStatuses, updateMintStatus]);

  const requestTokens = useCallback(async (tokenSymbol: string): Promise<void> => {
    if (!connected || !accountId) {
      return;
    }
    const token = tokens[tokenSymbol];
    if (!token) {
      return;
    }
    const faucetId = token.faucetId;
    updateMintStatus(tokenSymbol, {
      isLoading: true,
      lastAttempt: Date.now(),
      showMessage: false,
    });

    try {
      const result = await mintFromFaucet(
        accountIdToBech32(accountId),
        accountIdToBech32(faucetId),
      );
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
  }, [connected, accountId, updateMintStatus, tokens]);

  const getStatusIcon = (status: MintStatus): React.ReactNode => {
    if (status.isLoading) {
      return <Loader2 className='w-4 h-4 animate-spin text-blue-500' />;
    }

    return null;
  };

  const getButtonText = (tokenSymbol: string, status: MintStatus): string => {
    return status.isLoading ? `Minting ${tokenSymbol}...` : `Request ${tokenSymbol}`;
  };

  const isButtonDisabled = (status: MintStatus): boolean => {
    return status.isLoading || !connected;
  };

  if (tokensLoading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen p-3 pb-10'>
        <div className='w-full max-w-sm sm:max-w-md space-y-4'>
          <Skeleton className='h-[160px] w-full rounded-xl transition-all duration-400 ease-out opacity-20 border-2 border-orange-200 dark:border-orange-600/75' />
          <Skeleton className='h-[160px] w-full rounded-xl transition-all duration-400 ease-out opacity-20 border-2 border-orange-200 dark:border-orange-600/75' />
        </div>
      </div>
    );
  }

  if (Object.keys(tokens).length === 0) {
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
            {Object.values(tokens).map((token) => {
              const status = mintStatuses[token.symbol];

              if (!token || !status) return null;

              return (
                <Card
                  key={token.symbol}
                  className='rounded-xl hover:shadow-lg transition-all duration-200 hover:border-green-200/10'
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
                          <span className='hidden sm:inline'>
                            {accountIdToBech32(token.faucetId)}
                          </span>
                          <span className='sm:hidden break-all'>
                            {accountIdToBech32(token.faucetId)}
                          </span>
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
                                ? 'bg-transparent text-orange-800 dark:text-orange-200'
                                : 'bg-transparent text-red-800 dark:text-red-200'
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
                          onClick={() => requestTokens(token.symbol)}
                          disabled={isButtonDisabled(status)}
                          className='w-full bg-orange-800 hover:bg-orange-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {status.isLoading && (
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          )}
                          {getButtonText(token.symbol, status)}
                        </Button>
                      )}
                      {!connected && (
                        <WalletMultiButton className='!p-5 !w-full !h-full !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !text-orange-800 dark:!text-orange-200 animate-pulse hover:!text-foreground hover:!bg-gray-500/10 !text-center !flex !items-center !justify-center'>
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
