import { Button } from '@/components/ui/button';
import type { TokenConfig } from '@/providers/ZoroProvider';
import { formalBigIntFormat } from '@/utils/format';
import { CheckCircle, ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SwapResult {
  readonly txId?: string;
  readonly noteId?: string;
}

interface SwapDetails {
  readonly sellToken?: TokenConfig;
  readonly buyToken?: TokenConfig;
  readonly sellAmount?: bigint;
  readonly buyAmount?: bigint;
}

interface SwapSuccessProps {
  readonly onClose: () => void;
  readonly swapResult: SwapResult | null;
  readonly swapDetails: SwapDetails | null;
}

export function SwapSuccess({
  onClose,
  swapResult,
  swapDetails,
}: SwapSuccessProps) {
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (!isVisible) {
      setIsVisible(true);
    }
  }, [isVisible]);

  async function copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  const truncateId = (id: string): string => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  }, [onClose]);

  if (!swapResult) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-all duration-300 ease-in-out ${
          isVisible && !isClosing
            ? 'opacity-100'
            : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <div className='fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'>
        <div
          className={`w-80 max-w-[calc(100vw-2rem)] transition-all duration-300 ease-in-out ${
            isVisible && !isClosing
              ? 'opacity-100 translate-y-0 scale-100'
              : isVisible && isClosing
              ? 'opacity-0 translate-y-[-100%] scale-95'
              : 'opacity-0 translate-y-[100%] scale-95'
          }`}
        >
          <div className='bg-background border border-border rounded-2xl shadow-xl p-4'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2'>
                <img
                  src='/zoro_logo_with_outline.svg'
                  alt='Zoro'
                  className='w-8 h-8 -mt-1'
                />
                <span className='font-semibold text-sm'>Swap note created.</span>
              </div>
              <Button
                variant='ghost'
                size='icon'
                onClick={handleClose}
                className='h-6 w-6 rounded-full hover:bg-muted'
              >
                <X className='h-3 w-3' />
              </Button>
            </div>

            {swapDetails && (
              <div className='mb-4'>
                <div className='text-xs mb-3'>Order sent:</div>
                <div className='flex items-center justify-between px-3 text-sm'>
                  <div className='dark:text-red-200 text-red-700'>
                    {formalBigIntFormat({
                      val: swapDetails.sellAmount ?? BigInt(0),
                      expo: swapDetails.sellToken?.decimals || 6,
                    })} {swapDetails?.sellToken?.symbol}
                  </div>
                  <span className='text-muted-foreground text-xs'>for</span>
                  <div className='dark:text-green-200 text-green-700'>
                    {formalBigIntFormat({
                      val: swapDetails.buyAmount ?? BigInt(0),
                      expo: swapDetails.buyToken?.decimals || 6,
                    })} {swapDetails?.buyToken?.symbol}
                  </div>
                </div>
              </div>
            )}
            <div className='text-xs text-left mb-4'>
              You can claim your tokens in the wallet.
            </div>
            <div className='space-y-2'>
              <div>
                <label className='text-xs text-muted-foreground block mb-1'>
                  Note ID
                </label>
                <div className='flex items-center gap-1 p-2 bg-muted/50 rounded-md'>
                  <button
                    onClick={() => copyText(swapResult.noteId ?? '')}
                    className='text-xs flex-1 font-mono text-foreground text-left hover:bg-muted/50 rounded transition-colors cursor-pointer p-1'
                  >
                    {copiedText
                      ? (
                        <span className='flex items-center gap-1'>
                          <CheckCircle className='h-3 w-3 text-green-500' />
                          Copied!
                        </span>
                      )
                      : (
                        truncateId(swapResult.noteId ?? '')
                      )}
                  </button>
                  <a
                    href={`https://testnet.midenscan.com/note/${swapResult.noteId}`}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <ExternalLink className='h-4 w-4' />
                  </a>
                </div>
                <Button
                  onClick={handleClose}
                  className='mt-5 w-full h-full opacity-90 hover:opacity-100'
                  variant='secondary'
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
