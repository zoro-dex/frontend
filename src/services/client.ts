import { WebClient, AccountId } from '@demox-labs/miden-sdk';
import { NETWORK, TOKENS } from '@/lib/config';

// Type for account - derived from actual SDK return type
type MidenAccount = NonNullable<Awaited<ReturnType<WebClient['getAccount']>>>;

/**
 * Multi-balance data structure
 */
interface MultiBalanceData {
  readonly btcBalance: bigint;
  readonly ethBalance: bigint;
  readonly lastUpdated: number;
}

/**
 * Single balance data for backward compatibility
 */
interface BalanceData {
  readonly balance: bigint;
  readonly lastUpdated: number;
}

/**
 * Client state tracking
 */
interface ClientState {
  readonly client: WebClient;
  readonly isConnected: boolean;
  readonly lastSyncTime: number;
}

/**
 * Balance update callback types
 */
type BalanceUpdateCallback = (balance: bigint, lastUpdated: number) => void;
type MultiBalanceUpdateCallback = (balances: MultiBalanceData) => void;

/**
 * Enhanced singleton service managing WebClient with optimized multi-balance fetching
 */
class MidenClientService {
  private clientState: ClientState | null = null;
  private initializationPromise: Promise<WebClient> | null = null;
  private syncPromise: Promise<void> | null = null;
  
  // Multi-balance management - one fetch for both tokens
  private multiBalanceCache = new Map<string, MultiBalanceData>();
  private multiBalanceCallbacks = new Map<string, Set<MultiBalanceUpdateCallback>>();
  private multiFetchPromises = new Map<string, Promise<MultiBalanceData>>();
  
  // Legacy single balance support
  private balanceCache = new Map<string, BalanceData>();
  private balanceUpdateCallbacks = new Map<string, Set<BalanceUpdateCallback>>();
  
  // Configuration
  private static readonly SYNC_INTERVAL_MS = 30_000; // 30 seconds
  private static readonly BALANCE_CACHE_TTL = 10_000; // 10 seconds - short cache
  
  /**
   * Get or create the singleton WebClient instance
   */
  async getClient(): Promise<WebClient> {
    if (this.clientState?.isConnected) {
      return this.clientState.client;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.initializeClient();
    
    try {
      const client = await this.initializationPromise;
      return client;
    } finally {
      this.initializationPromise = null;
    }
  }
  
  /**
   * Initialize and sync the WebClient
   */
  private async initializeClient(): Promise<WebClient> {
    try {
      const client = await WebClient.createClient(NETWORK.rpcEndpoint);
      await client.syncState();
      
      this.clientState = {
        client,
        isConnected: true,
        lastSyncTime: Date.now(),
      };
      
      return client;
      
    } catch (error) {
      this.clientState = null;
      throw error;
    }
  }
  
  /**
   * Ensure client is synced (with debouncing)
   */
  async ensureSynced(forceSync: boolean = false): Promise<void> {
    if (!this.clientState?.isConnected) {
      await this.getClient();
      return;
    }
    
    const now = Date.now();
    const timeSinceLastSync = now - this.clientState.lastSyncTime;
    
    if (!forceSync && timeSinceLastSync < MidenClientService.SYNC_INTERVAL_MS) {
      return;
    }
    
    if (this.syncPromise) {
      await this.syncPromise;
      return;
    }
    
    this.syncPromise = this.performSync();
    
    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }
  
  /**
   * Perform the actual sync operation
   */
  private async performSync(): Promise<void> {
    if (!this.clientState) return;
    
    try {
      await this.clientState.client.syncState();
      
      this.clientState = {
        ...this.clientState,
        lastSyncTime: Date.now(),
      };
      
    } catch (error) {
      this.clientState = {
        ...this.clientState,
        isConnected: false,
      };
      
      throw error;
    }
  }
  
  /**
   * Generate cache key for balance entries
   */
  private getCacheKey(accountId: AccountId, faucetId: AccountId): string {
    return `${accountId.toBech32()}-${faucetId.toBech32()}`;
  }
  
  /**
   * Generate cache key for multi-balance entries (account only)
   */
  private getMultiBalanceCacheKey(accountId: AccountId): string {
    return accountId.toBech32();
  }
  
  /**
   * Type guard to check if account is valid
   */
  private isValidAccount(account: any): account is MidenAccount {
    return account !== null && account !== undefined && typeof account === 'object';
  }
  
  /**
   * Safely get account with proper error handling and type safety
   */
  private async getAccountSafely(
    client: WebClient,
    accountId: AccountId
  ): Promise<MidenAccount> {
    const accountResult = await client.getAccount(accountId);
    
    if (this.isValidAccount(accountResult)) {
      return accountResult;
    }
    
    // Account doesn't exist locally - import it
    try {
      await client.importAccountById(accountId);
    } catch (importError) {
      throw new Error(
        `Failed to import account ${accountId.toBech32()}: ${
          importError instanceof Error ? importError.message : 'Unknown error'
        }`
      );
    }
    
    // Retrieve after import
    const accountAfterImport = await client.getAccount(accountId);
    
    if (!this.isValidAccount(accountAfterImport)) {
      throw new Error(
        `Account ${accountId.toBech32()} still not found after import attempt. ` +
        `This might indicate the account doesn't exist on-chain.`
      );
    }
    
    return accountAfterImport;
  }
  
  /**
   * Fetch both BTC and ETH balances in a single blockchain call
   */
  private async fetchMultiBalanceFromChain(accountId: AccountId): Promise<MultiBalanceData> {
    const client = await this.getClient();
    await this.ensureSynced();
    
    try {
      const account = await this.getAccountSafely(client, accountId);
      const btcBalance = account.vault().getBalance(AccountId.fromBech32(TOKENS.BTC.faucetId));
      const ethBalance = account.vault().getBalance(AccountId.fromBech32(TOKENS.ETH.faucetId));
      
      return {
        btcBalance: BigInt(btcBalance ?? 0),
        ethBalance: BigInt(ethBalance ?? 0),
        lastUpdated: Date.now(),
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get both token balances with single blockchain call
   */
  async getMultiBalance(
    accountId: AccountId,
    useCache: boolean = true
  ): Promise<MultiBalanceData> {
    const cacheKey = this.getMultiBalanceCacheKey(accountId);
    
    // Check memory cache first
    if (useCache) {
      const cached = this.multiBalanceCache.get(cacheKey);
      if (cached) {
        const age = Date.now() - cached.lastUpdated;
        if (age < MidenClientService.BALANCE_CACHE_TTL) {
          return cached;
        }
      }
    }
    
    // Deduplicate concurrent requests
    const existingFetch = this.multiFetchPromises.get(cacheKey);
    if (existingFetch) {
      return await existingFetch;
    }
    
    // Start fresh fetch
    const fetchPromise = this.fetchMultiBalanceFromChain(accountId);
    this.multiFetchPromises.set(cacheKey, fetchPromise);
    
    try {
      const freshBalances = await fetchPromise;
      
      // Update cache
      this.multiBalanceCache.set(cacheKey, freshBalances);
      
      // Update individual balance caches for backward compatibility
      this.updateSingleBalanceCaches(accountId, freshBalances);
      
      // Notify multi-balance subscribers
      this.notifyMultiBalanceUpdate(cacheKey, freshBalances);
      
      return freshBalances;
      
    } finally {
      this.multiFetchPromises.delete(cacheKey);
    }
  }
  
  /**
   * Update individual balance caches when multi-balance is fetched
   */
  private updateSingleBalanceCaches(accountId: AccountId, balances: MultiBalanceData): void {
    const btcCacheKey = this.getCacheKey(accountId, AccountId.fromBech32(TOKENS.BTC.faucetId));
    const ethCacheKey = this.getCacheKey(accountId, AccountId.fromBech32(TOKENS.ETH.faucetId));
    
    const btcEntry: BalanceData = {
      balance: balances.btcBalance,
      lastUpdated: balances.lastUpdated,
    };
    
    const ethEntry: BalanceData = {
      balance: balances.ethBalance,
      lastUpdated: balances.lastUpdated,
    };
    
    this.balanceCache.set(btcCacheKey, btcEntry);
    this.balanceCache.set(ethCacheKey, ethEntry);
    
    // Notify individual balance subscribers
    this.notifyBalanceUpdate(btcCacheKey, balances.btcBalance, balances.lastUpdated);
    this.notifyBalanceUpdate(ethCacheKey, balances.ethBalance, balances.lastUpdated);
  }
  
  /**
   * Legacy single balance API - now uses multi-balance internally for efficiency
   */
  async getBalance(
    accountId: AccountId,
    faucetId: AccountId,
    useCache: boolean = true
  ): Promise<{ balance: bigint; lastUpdated: number }> {
    // Use multi-balance fetch for efficiency, then extract the requested token
    const multiBalance = await this.getMultiBalance(accountId, useCache);
    
    const btcFaucetId = TOKENS.BTC.faucetId;
    const ethFaucetId = TOKENS.ETH.faucetId;
    const requestedFaucetId = faucetId.toBech32();
    
    if (requestedFaucetId === btcFaucetId) {
      return {
        balance: multiBalance.btcBalance,
        lastUpdated: multiBalance.lastUpdated,
      };
    } else if (requestedFaucetId === ethFaucetId) {
      return {
        balance: multiBalance.ethBalance,
        lastUpdated: multiBalance.lastUpdated,
      };
    }
    
    // Fallback for unknown tokens (should not happen in current system)
    throw new Error(`Unsupported faucet ID: ${requestedFaucetId}`);
  }
  
  /**
   * Subscribe to multi-balance updates
   */
  subscribeToMultiBalanceUpdates(
    accountId: AccountId,
    callback: MultiBalanceUpdateCallback
  ): () => void {
    const cacheKey = this.getMultiBalanceCacheKey(accountId);
    
    if (!this.multiBalanceCallbacks.has(cacheKey)) {
      this.multiBalanceCallbacks.set(cacheKey, new Set());
    }
    
    this.multiBalanceCallbacks.get(cacheKey)!.add(callback);
    
    return () => {
      const callbacks = this.multiBalanceCallbacks.get(cacheKey);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.multiBalanceCallbacks.delete(cacheKey);
          this.multiBalanceCache.delete(cacheKey);
        }
      }
    };
  }
  
  /**
   * Subscribe to single balance updates (legacy API)
   */
  subscribeToBalanceUpdates(
    accountId: AccountId,
    faucetId: AccountId,
    callback: BalanceUpdateCallback
  ): () => void {
    const cacheKey = this.getCacheKey(accountId, faucetId);
    
    if (!this.balanceUpdateCallbacks.has(cacheKey)) {
      this.balanceUpdateCallbacks.set(cacheKey, new Set());
    }
    
    this.balanceUpdateCallbacks.get(cacheKey)!.add(callback);
    
    return () => {
      const callbacks = this.balanceUpdateCallbacks.get(cacheKey);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.balanceUpdateCallbacks.delete(cacheKey);
          this.balanceCache.delete(cacheKey);
        }
      }
    };
  }
  
  /**
   * Notify multi-balance subscribers
   */
  private notifyMultiBalanceUpdate(cacheKey: string, balances: MultiBalanceData): void {
    const callbacks = this.multiBalanceCallbacks.get(cacheKey);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(balances);
        } catch (error) {
          // Silent callback failures
        }
      });
    }
  }
  
  /**
   * Notify single balance subscribers
   */
  private notifyBalanceUpdate(
    cacheKey: string,
    balance: bigint,
    lastUpdated: number
  ): void {
    const callbacks = this.balanceUpdateCallbacks.get(cacheKey);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(balance, lastUpdated);
        } catch (error) {
          // Silent callback failures
        }
      });
    }
  }
  
  /**
   * Force refresh balances from blockchain
   */
  async refreshBalance(accountId: AccountId, faucetId: AccountId): Promise<void> {
    await this.getBalance(accountId, faucetId, false);
  }
  
  /**
   * Force refresh all balances for an account
   */
  async refreshAllBalances(accountId?: AccountId): Promise<void> {
    if (accountId) {
      // Refresh specific account
      await this.getMultiBalance(accountId, false);
      return;
    }
    
    // Refresh all cached accounts
    const refreshPromises: Promise<void>[] = [];
    const cacheKeys = Array.from(this.multiBalanceCache.keys());
    
    for (const cacheKey of cacheKeys) {
      try {
        const accountId = AccountId.fromBech32(cacheKey);
        const refreshPromise = this.getMultiBalance(accountId, false)
          .then(() => {})
          .catch(() => {});
        refreshPromises.push(refreshPromise);
      } catch (error) {
        // Silent error handling for malformed cache keys
      }
    }
    
    await Promise.allSettled(refreshPromises);
  }
  
  /**
   * Get client connection status
   */
  getStatus(): { connected: boolean; lastSync: number | null } {
    return {
      connected: this.clientState?.isConnected ?? false,
      lastSync: this.clientState?.lastSyncTime ?? null,
    };
  }
  
  /**
   * Clear all balance caches
   */
  clearBalanceCaches(): void {
    this.multiBalanceCache.clear();
    this.multiBalanceCallbacks.clear();
    this.balanceCache.clear();
    this.balanceUpdateCallbacks.clear();
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clientState = null;
    this.initializationPromise = null;
    this.syncPromise = null;
    this.clearBalanceCaches();
  }
}

// Export singleton instance
export const midenClientService = new MidenClientService();

// Export types for use in other modules
export type { MultiBalanceData, BalanceData };