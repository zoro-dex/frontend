import { Button } from '@/components/ui/button';
import { type TokenSymbol } from '@/lib/config';
import { CheckCircle, X, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SwapResult {
  readonly txId: string;
  readonly noteId: string;
}

interface SwapDetails {
  readonly sellToken: TokenSymbol;
  readonly buyToken: TokenSymbol;
  readonly sellAmount: string;
  readonly buyAmount: string;
}

interface SwapSuccessProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly swapResult: SwapResult | null;
  readonly swapDetails: SwapDetails | null;
}

export function SwapSuccess({ 
  isOpen, 
  onClose, 
  swapResult,
  swapDetails
}: SwapSuccessProps) {
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const copyNoteId = useCallback(async (noteId: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(noteId);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = noteId;
      document.body.appendChild(textArea);
      textArea.select();
      document.body.removeChild(textArea);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    }
  }, []);

  const formatAmount = useCallback((amount: string): string => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    
    if (num >= 1) {
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 6 
      });
    }
    
    return parseFloat(num.toFixed(7)).toString();
  }, []);

  const truncateId = (id: string): string => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const openMidenScan = useCallback((noteId: string): void => {
    window.open(`https://testnet.midenscan.com/note/${noteId}`, '_blank', 'noopener,noreferrer');
  }, []);

  if (!isOpen || !swapResult) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />
      
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
        <div 
          className={`w-80 max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${
            isVisible 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <div className="bg-background border border-border rounded-2xl shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img src="/zoro_logo_with_outline.svg" alt="Zoro" className="w-8 h-8 -mt-1" />
                <span className="font-semibold text-sm">Swap note created.</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-6 w-6 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

                {swapDetails && (
  <div className="mb-4">
    <div className="text-xs mb-3">Order sent:</div>
    <div className="flex items-center justify-between px-1 text-xs">
      <div className="dark:text-red-200 text-red-700">
        {formatAmount(swapDetails.sellAmount)} {swapDetails.sellToken}
      </div>
      <span className="text-muted-foreground">for</span>
      <div className="dark:text-green-200 text-green-700">
        {formatAmount(swapDetails.buyAmount)} {swapDetails.buyToken}
      </div>
    </div>
  </div>
)}
            
            <div className="text-xs text-left mb-4">
              Your tokens will be claimable in the wallet!
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Note ID
                </label>
                <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-md">
                  <button
                    onClick={() => copyNoteId(swapResult.noteId)}
                    className="text-xs flex-1 font-mono text-foreground text-left hover:bg-muted/50 rounded transition-colors cursor-pointer p-1"
                  >
                    {copiedNote ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Copied!
                      </span>
                    ) : (
                      truncateId(swapResult.noteId)
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openMidenScan(swapResult.noteId)}
                    className="h-6 w-6 p-0 hover:bg-muted"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}