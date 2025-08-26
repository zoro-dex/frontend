import { WebClient, AccountId } from '@demox-labs/miden-sdk';
import { NETWORK } from '@/lib/config';

// Type for account - derived from actual SDK return type
type MidenAccount = NonNullable<Awaited<ReturnType<WebClient['getAccount']>>>;

/**
 * Client state tracking
 */
interface ClientState {
  readonly client: WebClient;
  readonly isConnected: boolean;
  readonly lastSyncTime: number;
}

/**
 * Simple balance data
 */
interface BalanceData {
  readonly balance: bigint;
  readonly lastUpdated: number;
}

/**
 * Balance update callback type
 */
type BalanceUpdateCallback = (balance: bigint, lastUpdated: number) => void;

/**
 * Simple singleton service managing WebClient and balance fetching
 * No optimistic updates, no localStorage caching - just reliable data fetching
 */
class MidenClientService {
  private clientState: ClientState | null = null;
  private initializationPromise: Promise<WebClient> | null = null;
  private syncPromise: Promise<void> | null = null;
  
  // Simple balance management - memory only
  private balanceCache = new Map<string, BalanceData>();
  private balanceUpdateCallbacks = new Map<string, Set<BalanceUpdateCallback>>();
  private fetchingPromises = new Map<string, Promise<bigint>>();
  
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
   * Fetch balance from blockchain - NO OPTIMISTIC UPDATES
   */
  private async fetchBalanceFromChain(
    accountId: AccountId, 
    faucetId: AccountId
  ): Promise<bigint> {
    const client = await this.getClient();
    await this.ensureSynced();
    
    try {
      const account = await this.getAccountSafely(client, accountId);
      const balance = account.vault().getBalance(faucetId);
      return BigInt(balance ?? 0);
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get balance with simple memory caching only
   * No localStorage, no optimistic updates - just fast, reliable data
   */
  async getBalance(
    accountId: AccountId,
    faucetId: AccountId,
    useCache: boolean = true
  ): Promise<{ balance: bigint; lastUpdated: number }> {
    const cacheKey = this.getCacheKey(accountId, faucetId);
    
    // Check memory cache first
    if (useCache) {
      const cached = this.balanceCache.get(cacheKey);
      if (cached) {
        const age = Date.now() - cached.lastUpdated;
        if (age < MidenClientService.BALANCE_CACHE_TTL) {
          return {
            balance: cached.balance,
            lastUpdated: cached.lastUpdated,
          };
        }
      }
    }
    
    // Deduplicate concurrent requests
    const existingFetch = this.fetchingPromises.get(cacheKey);
    if (existingFetch) {
      const balance = await existingFetch;
      const entry = this.balanceCache.get(cacheKey);
      return {
        balance,
        lastUpdated: entry?.lastUpdated ?? Date.now(),
      };
    }
    
    // Start fresh fetch
    const fetchPromise = this.fetchBalanceFromChain(accountId, faucetId);
    this.fetchingPromises.set(cacheKey, fetchPromise);
    
    try {
      const freshBalance = await fetchPromise;
      const now = Date.now();
      
      // Update cache
      const entry: BalanceData = {
        balance: freshBalance,
        lastUpdated: now,
      };
      
      this.balanceCache.set(cacheKey, entry);
      
      // Notify subscribers
      this.notifyBalanceUpdate(cacheKey, freshBalance, now);
      
      return {
        balance: freshBalance,
        lastUpdated: now,
      };
      
    } finally {
      this.fetchingPromises.delete(cacheKey);
    }
  }
  
  /**
   * Subscribe to balance updates for reactive UI
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
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.balanceUpdateCallbacks.get(cacheKey);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.balanceUpdateCallbacks.delete(cacheKey);
          // Also clear the cache entry if no one is listening
          this.balanceCache.delete(cacheKey);
        }
      }
    };
  }
  
  /**
   * Notify all subscribers of balance updates
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
          // Silent callback failures - don't break the system
        }
      });
    }
  }
  
  /**
   * Force refresh balance from blockchain
   */
  async refreshBalance(accountId: AccountId, faucetId: AccountId): Promise<void> {
    await this.getBalance(accountId, faucetId, false);
  }
  
  /**
   * Refresh all cached balances (useful after transactions or token swaps)
   */
  async refreshAllBalances(): Promise<void> {
    const refreshPromises: Promise<void>[] = [];
    
    // Create a copy of current cache keys to avoid concurrent modification
    const cacheKeys = Array.from(this.balanceCache.keys());
    
    for (const cacheKey of cacheKeys) {
      const [accountBech32, faucetBech32] = cacheKey.split('-');
      try {
        const accountId = AccountId.fromBech32(accountBech32);
        const faucetId = AccountId.fromBech32(faucetBech32);
        
        // Force refresh each balance
        const refreshPromise = this.getBalance(accountId, faucetId, false)
          .then(() => {
            // Silent success
          })
          .catch(error => {
            // Silent error handling
          });
          
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