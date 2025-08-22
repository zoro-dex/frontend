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

    console.log('🔄 Transaction started:', { txId, noteId, timestamp: new Date().toISOString() });  
  }, [handlers]);

  // Set up wallet event listeners
  useEffect(() => {
    if (!wallet?.adapter) {
      cleanup();
      return;
    }

    console.log('🔌 Setting up wallet event listeners...');

    // Ready state change listener
    const handleReadyStateChange = (state: string) => {
      console.log('📡 Wallet ready state changed:', state);
      handlers.onReadyStateChange?.(state);
    };

    // Connection listener
    const handleConnect = () => {
      const accountId = wallet.adapter.accountId;
      console.log('🔗 Wallet connected:', accountId);
      handlers.onConnect?.(accountId || 'unknown');
    };

    // Disconnection listener
    const handleDisconnect = () => {
      console.log('🔌 Wallet disconnected');
      // Clear pending transactions on disconnect
      pendingTransactionsRef.current.clear();
      handlers.onDisconnect?.();
    };

    // Error listener
    const handleError = (error: Error) => {
      console.error('❌ Wallet error:', error);
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

      console.log('✅ Wallet event listeners registered');
    } catch (error) {
      console.error('Failed to register wallet listeners:', error);
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