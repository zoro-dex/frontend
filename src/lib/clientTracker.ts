interface ClientOperation {
  id: number;
  operation: string;
  timestamp: string;
  completed: boolean;
}

class ClientAccessTracker {
  private accessCount = 0;
  private activeOperations: ClientOperation[] = [];

  trackAccess(operation: string): number {
    this.accessCount++;
    const op: ClientOperation = {
      id: this.accessCount,
      operation,
      timestamp: new Date().toISOString(),
      completed: false,
    };
    
    this.activeOperations.push(op);
    
    return this.accessCount;
  }

  trackComplete(operationId: number ): void {
    const op = this.activeOperations.find(o => o.id === operationId);
    if (op) {
      op.completed = true;
    }
    
    // Clean up old completed operations (keep last 10)
    this.activeOperations = this.activeOperations
      .filter(o => !o.completed)
      .concat(
        this.activeOperations
          .filter(o => o.completed)
          .slice(-10)
      );
  }

  getActiveCount(): number {
    return this.activeOperations.filter(o => !o.completed).length;
  }

  getRecentOperations(): string[] {
    return this.activeOperations
      .slice(-5)
      .map(op => `${op.id}: ${op.operation}${op.completed ? ' ✅' : ' 🔄'}`);
  }

  onWasmError(): void {
    console.log('💥 WASM ERROR DETECTED!');
    console.log('🔍 All operations:', this.activeOperations.slice(-10));
    console.log('📊 Total client accesses:', this.accessCount);
    console.log('⚠️ Active operations:', this.getActiveCount());
  }
}

export const clientTracker = new ClientAccessTracker();

// Set up global error handling
const originalError = console.error;
console.error = function(...args: unknown[]) {
  if (args[0] && typeof args[0] === 'string' && 
      (args[0].includes('null pointer passed to rust') || 
       args[0].includes('recursive use of an object detected'))) {
    clientTracker.onWasmError();
  }
  originalError.apply(console, args);
};