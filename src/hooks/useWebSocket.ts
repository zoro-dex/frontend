import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWebSocket, type MessageHandler, type ServerMessage, type SubscriptionChannel } from '@/services/websocket';

export interface UseWebSocketOptions {
  /**
   * Channels to subscribe to on mount
   */
  channels?: SubscriptionChannel[];

  /**
   * Message handler callback
   */
  onMessage?: MessageHandler;

  /**
   * Auto-connect on mount (default: true)
   */
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  /**
   * WebSocket connection state
   */
  isConnected: boolean;

  /**
   * Subscribe to additional channels
   */
  subscribe: (channels: SubscriptionChannel[]) => void;

  /**
   * Unsubscribe from channels
   */
  unsubscribe: (channels: SubscriptionChannel[]) => void;

  /**
   * Manually connect
   */
  connect: () => void;

  /**
   * Manually disconnect
   */
  disconnect: () => void;
}

/**
 * React hook for WebSocket connection management
 *
 * Automatically connects on mount and disconnects on unmount.
 * Subscribes to specified channels and handles messages.
 *
 * @example
 * ```tsx
 * const { isConnected } = useWebSocket({
 *   channels: [{ channel: 'oracle_prices' }],
 *   onMessage: (msg) => {
 *     if (msg.type === 'OraclePriceUpdate') {
 *       console.log('Price update:', msg.price);
 *     }
 *   },
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { channels = [], onMessage, autoConnect = true } = options;

  const ws = getWebSocket();
  const [isConnected, setIsConnected] = useState(ws.isConnected());
  const channelsRef = useRef(channels);
  const onMessageRef = useRef(onMessage);

  // Keep refs up to date
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Connection state monitoring
  useEffect(() => {
    const checkConnection = setInterval(() => {
      setIsConnected(ws.isConnected());
    }, 1000);

    return () => clearInterval(checkConnection);
  }, [ws]);

  // Auto-connect and message handling
  useEffect(() => {
    if (autoConnect) {
      ws.connect();
    }

    // Register message handler
    const unsubscribeHandler = ws.addMessageHandler((message: ServerMessage) => {
      setIsConnected(true);
      onMessageRef.current?.(message);
    });

    return () => {
      unsubscribeHandler();
    };
  }, [ws, autoConnect]);

  // Subscribe to channels
  useEffect(() => {
    if (channels.length === 0) return;

    // Wait for connection before subscribing
    const subscribeWhenReady = () => {
      if (ws.isConnected()) {
        ws.subscribe(channels);
      } else {
        // Retry after a short delay
        setTimeout(subscribeWhenReady, 100);
      }
    };

    subscribeWhenReady();

    return () => {
      if (ws.isConnected()) {
        ws.unsubscribe(channels);
      }
    };
  }, [ws, channels]);

  return {
    isConnected,
    subscribe: (channels: SubscriptionChannel[]) => ws.subscribe(channels),
    unsubscribe: (channels: SubscriptionChannel[]) => ws.unsubscribe(channels),
    connect: () => ws.connect(),
    disconnect: () => ws.disconnect(),
  };
}

/**
 * Hook specifically for oracle price updates
 *
 * @example
 * ```tsx
 * const { prices } = useOraclePriceWebSocket(['BTC', 'ETH']);
 * ```
 */
export function useOraclePriceWebSocket(oracleIds?: string[]) {
  const [prices, setPrices] = useState<Record<string, { price: number; timestamp: number }>>({});

  const channels: SubscriptionChannel[] = useMemo(
    () =>
      oracleIds && oracleIds.length > 0
        ? oracleIds.map(id => ({ channel: 'oracle_prices' as const, oracle_id: id }))
        : [{ channel: 'oracle_prices' as const }],
    [oracleIds]
  );

  useWebSocket({
    channels,
    onMessage: (message) => {
      if (message.type === 'OraclePriceUpdate') {
        setPrices(prev => ({
          ...prev,
          [message.oracle_id]: {
            price: message.price,
            timestamp: message.timestamp,
          },
        }));
      }
    },
  });

  return { prices };
}

/**
 * Hook for tracking order status updates
 *
 * @example
 * ```tsx
 * const { orderStatus, subscribeToOrder } = useOrderUpdates();
 *
 * // Subscribe to a specific order
 * subscribeToOrder('order-id-123');
 *
 * // Check order status
 * if (orderStatus['order-id-123']?.status === 'executed') {
 *   console.log('Order completed!');
 * }
 * ```
 */
export function useOrderUpdates(orderIds?: string[]) {
  const [orderStatus, setOrderStatus] = useState<Record<string, {
    status: import('@/services/websocket').OrderStatus;
    timestamp: number;
    details: import('@/services/websocket').OrderUpdateDetails;
  }>>({});

  const channels: SubscriptionChannel[] = useMemo(() => {
    // If orderIds is undefined or empty, subscribe to all order updates
    if (!orderIds || orderIds.length === 0) {
      return [{ channel: 'order_updates' as const }];
    }
    // Otherwise subscribe to specific order IDs
    return orderIds.map(id => ({ channel: 'order_updates' as const, order_id: id }));
  }, [orderIds]);

  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    channels,
    onMessage: (message) => {
      if (message.type === 'OrderUpdate') {
        // Key by note_id so frontend can look up status by the note hash it knows
        setOrderStatus(prev => ({
          ...prev,
          [message.note_id]: {
            status: message.status,
            timestamp: message.timestamp,
            details: message.details,
          },
        }));
      }
    },
  });

  const subscribeToOrder = useCallback((orderId: string) => {
    subscribe([{ channel: 'order_updates', order_id: orderId }]);
  }, [subscribe]);

  const unsubscribeFromOrder = useCallback((orderId: string) => {
    unsubscribe([{ channel: 'order_updates', order_id: orderId }]);
  }, [unsubscribe]);

  return {
    orderStatus,
    subscribeToOrder,
    unsubscribeFromOrder,
    isConnected,
  };
}

/**
 * Hook for tracking pool state updates
 *
 * @example
 * ```tsx
 * const { poolStates } = usePoolStateUpdates(['faucet-1', 'faucet-2']);
 *
 * // Access pool balances
 * const pool = poolStates['faucet-1'];
 * console.log(pool?.balances);
 * ```
 */
export function usePoolStateUpdates(faucetIds?: string[]) {
  const [poolStates, setPoolStates] = useState<Record<string, {
    balances: {
      reserve: string;
      reserve_with_slippage: string;
      total_liabilities: string;
    };
    timestamp: number;
  }>>({});

  const channels: SubscriptionChannel[] = useMemo(
    () =>
      faucetIds && faucetIds.length > 0
        ? faucetIds.map(id => ({ channel: 'pool_state' as const, faucet_id: id }))
        : [{ channel: 'pool_state' as const }],
    [faucetIds]
  );

  useWebSocket({
    channels,
    onMessage: (message) => {
      if (message.type === 'PoolStateUpdate') {
        setPoolStates(prev => ({
          ...prev,
          [message.faucet_id]: {
            balances: message.balances,
            timestamp: message.timestamp,
          },
        }));
      }
    },
  });

  return { poolStates };
}

/**
 * Hook for tracking general stats updates
 *
 * @example
 * ```tsx
 * const { stats } = useStatsUpdates();
 *
 * console.log(`Open orders: ${stats?.open_orders}`);
 * console.log(`Closed orders: ${stats?.closed_orders}`);
 * ```
 */
export function useStatsUpdates() {
  const [stats, setStats] = useState<{
    open_orders: number;
    closed_orders: number;
    timestamp: number;
  } | null>(null);

  const channels: SubscriptionChannel[] = useMemo(() => [{ channel: 'stats' as const }], []);

  useWebSocket({
    channels,
    onMessage: (message) => {
      if (message.type === 'StatsUpdate') {
        setStats({
          open_orders: message.open_orders,
          closed_orders: message.closed_orders,
          timestamp: message.timestamp,
        });
      }
    },
  });

  return { stats };
}
