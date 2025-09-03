import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SwapResult {
  readonly txId: string;
  readonly noteId: string;
}

interface SwapProps {
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
}: SwapProps) {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

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
      
      {/* Centered Popup */}
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
                <img src="/zoro_logo_with_outline.svg" alt="Zoro" className="w-8 h-8 -ml-2 -mt-1" />
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
            
            <div className="text-xs text-center">
              <span className="animate-pulse text-green-500">Click on the Miden wallet extension to continue.</span>
              <br/><br/>
              After processing the swap, your tokens will be claimable in the wallet.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}