import { Button } from '@/components/ui/button';
import { CheckCircle, Copy, ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SwapResult {
  readonly txId: string;
  readonly noteId: string;
}

interface ZoroChatBubbleProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly swapResult: SwapResult | null;
  readonly sellToken?: string;
  readonly buyToken?: string;
  readonly sellAmount?: string;
}

export function SwapSuccess({ 
  isOpen, 
  onClose, 
  swapResult, 
  sellToken, 
  buyToken, 
  sellAmount 
}: ZoroChatBubbleProps) {
  const [copiedTx, setCopiedTx] = useState<boolean>(false);
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

    const copyToClipboard = useCallback(async (text: string, type: 'tx' | 'note'): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'tx') {
        setCopiedTx(true);
        setTimeout(() => setCopiedTx(false), 2000);
      } else {
        setCopiedNote(true);
        setTimeout(() => setCopiedNote(false), 2000);
      }
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.body.removeChild(textArea);
    }
  }, []);

  const truncateId = (id: string): string => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  if (!isOpen || !swapResult) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />
      
      {/* Centered Chat Bubble */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
        <div 
          className={`w-80 max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${
            isVisible 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <div className="bg-background border border-border rounded-2xl shadow-xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img src="/Zoro_logo_final3.svg" alt="Zoro" className="w-8 h-8 -ml-2 -mt-1" />
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
            
            <div className="text-xs text-muted-foreground text-center">
              <span className="">Click on the Miden wallet extension to continue.</span>
            </div>

            <br/>

            {/* Trade summary */}
            {sellToken && buyToken && sellAmount && (
              <div className="mb-3 p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Your trade</p>
                <p className="text-sm font-medium">
                  {sellAmount} {sellToken} → {buyToken}
                </p>
              </div>
            )}

            {/* Transaction details */}
            <div className="space-y-2 mb-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Transaction ID
                </label>
                <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-md">
                  <code className="text-xs flex-1 font-mono text-foreground">
                    {truncateId(swapResult.txId)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(swapResult.txId, 'tx')}
                    className="h-6 w-6 p-0 hover:bg-muted"
                  >
                    {copiedTx ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Note ID
                </label>
                <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-md">
                  <code className="text-xs flex-1 font-mono text-foreground">
                    {truncateId(swapResult.noteId)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(swapResult.noteId, 'note')}
                    className="h-6 w-6 p-0 hover:bg-muted"
                  >
                    {copiedNote ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="text-center">
              <Button 
                onClick={handleClose}
                size="sm"
                className="h-8 w-1/3 text-xs bg-primary/90 hover:bg-primary/60"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}