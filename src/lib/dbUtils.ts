/**
 * Utility functions for managing Miden WebClient database state
 */

export interface DatabaseResetResult {
  success: boolean;
  deletedDatabases: string[];
  error?: string;
}

/**
 * Clear all Miden-related databases to fix corruption issues
 */
export const resetMidenDatabase = async (): Promise<DatabaseResetResult> => {
  try {
    const databases = await indexedDB.databases();
    const deletedDatabases: string[] = [];
    
    // Delete all databases (Miden stores data across multiple DBs)
    for (const db of databases) {
      if (db.name) {
        await deleteDatabase(db.name);
        deletedDatabases.push(db.name);
        console.log(`Deleted database: ${db.name}`);
      }
    }
    
    return {
      success: true,
      deletedDatabases
    };
  } catch (error) {
    console.error('Failed to reset databases:', error);
    return {
      success: false,
      deletedDatabases: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Delete a specific IndexedDB database
 */
const deleteDatabase = (name: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(name);
    
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => reject(deleteRequest.error);
    deleteRequest.onblocked = () => {
      console.warn(`Database ${name} deletion blocked`);
      // Force resolve after timeout if blocked
      setTimeout(resolve, 1000);
    };
  });
};

/**
 * Check if database corruption error
 */
export const isDatabaseCorruptionError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return message.includes('key already exists') ||
         message.includes('constrainterror') ||
         message.includes('database-related non-query error');
};

/**
 * Auto-recovery wrapper for WebClient operations
 */
export const withDatabaseRecovery = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isCorruption = error instanceof Error && isDatabaseCorruptionError(error);
      
      if (isCorruption && !isLastAttempt) {
        console.warn(`Database corruption detected (attempt ${attempt + 1}), resetting...`);
        await resetMidenDatabase();
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
};