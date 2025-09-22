// lib/memory/memory.ts
/**
 * Production Memory Service
 * Real memory management and storage functionality
 */

export interface MemoryService {
  set(key: string, value: unknown, context?: string, ttlMs?: number): Promise<void>;
  get(key: string): Promise<unknown | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

class ProductionMemoryService implements MemoryService {
  private memory: Map<string, { value: any; expires?: number }> = new Map();

  async set(key: string, value: unknown, context?: string, ttlMs?: number): Promise<void> {
    const expires = ttlMs ? Date.now() + ttlMs : undefined;
    this.memory.set(key, { value, expires });
  }

  async get(key: string): Promise<unknown | null> {
    const item = this.memory.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (item.expires && Date.now() > item.expires) {
      this.memory.delete(key);
      return null;
    }

    return item.value;
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key);
  }

  async clear(): Promise<void> {
    this.memory.clear();
  }

  async keys(): Promise<string[]> {
    // Clean up expired keys
    const now = Date.now();
    for (const [key, item] of this.memory.entries()) {
      if (item.expires && now > item.expires) {
        this.memory.delete(key);
      }
    }
    
    return Array.from(this.memory.keys());
  }

  async has(key: string): Promise<boolean> {
    const item = this.memory.get(key);
    
    if (!item) {
      return false;
    }

    // Check if expired
    if (item.expires && Date.now() > item.expires) {
      this.memory.delete(key);
      return false;
    }

    return true;
  }
}

// Export factory function
export function createMemory(): MemoryService {
  return new ProductionMemoryService();
}

// Export singleton instance
export const memoryService = new ProductionMemoryService();
