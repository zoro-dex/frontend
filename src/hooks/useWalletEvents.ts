import { useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@demox-labs/miden-wallet-adapter';

export interface TransactionStatus {
  readonly id: string;
  readonly status: 'pending' | 'confirmed' | 'ready_to_claim' | 'failed';
  readonly timestamp: number;
  readonly noteId?: string;
}

export interface WalletEventHandlers {
  onReadyStateChange?: (state: string) => void;
  onConnect?: (accountId: string) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onTransactionStatusChange?: (status: TransactionStatus) => void;
}

/**
 * Custom hook to track wallet events and transaction status
 * Provides comprehensive event tracking for Zoro AMM operations
 */
export const useWalletEventTracker = (handlers: WalletEventHandlers = {}) => {
  const { wallet, connected } = useWallet();
  const listenersRef = useRef<Array<() => void>>([]);
  const pendingTransactionsRef = useRef<Map<string, TransactionStatus>>(new Map());

  // Clean up listeners on unmount
  const cleanup = useCallback(() => {
    listenersRef.current.forEach(removeListener => removeListener());
    listenersRef.current = [];
  }, []);

  // Track transaction status changes
  const trackTransaction = useCallback((txId: string, noteId?: string) => {
    const status: TransactionStatus = {
      id: txId,
      status: 'pending',
      timestamp: Date.now(),
      noteId,
    };

    pendingTransactionsRef.current.set(txId, status);
    handlers.onTransactionStatusChange?.(status);
  }, [handlers]);

  // Set up wallet event listeners
  useEffect(() => {
    if (!wallet?.adapter) {
      cleanup();
      return;
    }

    // Ready state change listener
    const handleReadyStateChange = (state: string) => {
      handlers.onReadyStateChange?.(state);
    };

    // Connection listener
    const handleConnect = () => {
      const accountId = wallet.adapter.accountId;
      handlers.onConnect?.(accountId || 'unknown');
    };

    // Disconnection listener
    const handleDisconnect = () => {
      // Clear pending transactions on disconnect
      pendingTransactionsRef.current.clear();
      handlers.onDisconnect?.();
    };

    // Error listener
    const handleError = (error: Error) => {
      handlers.onError?.(error);
    };

    // Add listeners and store cleanup functions
    try {
      const removeReadyStateListener = () => {
        wallet.adapter.removeListener('readyStateChange', handleReadyStateChange);
      };
      const removeConnectListener = () => {
        wallet.adapter.removeListener('connect', handleConnect);
      };
      const removeDisconnectListener = () => {
        wallet.adapter.removeListener('disconnect', handleDisconnect);
      };
      const removeErrorListener = () => {
        wallet.adapter.removeListener('error', handleError);
      };

      wallet.adapter.addListener('readyStateChange', handleReadyStateChange);
      wallet.adapter.addListener('connect', handleConnect);
      wallet.adapter.addListener('disconnect', handleDisconnect);
      wallet.adapter.addListener('error', handleError);

      listenersRef.current = [
        removeReadyStateListener,
        removeConnectListener,
        removeDisconnectListener,
        removeErrorListener,
      ];

    } catch (error) {
      // Silent fail - event listeners are best effort
    }

    return cleanup;
  }, [wallet?.adapter, handlers, cleanup]);

  // Get current transaction status
  const getTransactionStatus = useCallback((txId: string): TransactionStatus | undefined => {
    return pendingTransactionsRef.current.get(txId);
  }, []);

  // Get all pending transactions
  const getPendingTransactions = useCallback((): TransactionStatus[] => {
    return Array.from(pendingTransactionsRef.current.values());
  }, []);

  return {
    trackTransaction,
    getTransactionStatus,
    getPendingTransactions,
    isConnected: connected,
  };
};