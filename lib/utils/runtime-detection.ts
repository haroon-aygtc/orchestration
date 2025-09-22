// lib/utils/runtime-detection.ts
/**
 * Runtime Detection and Capability Management
 * Provides runtime environment detection and capability flags for tools
 */

export type RuntimeEnvironment = 'node' | 'edge' | 'browser' | 'unknown';
export type Capability = 'file-system' | 'crypto' | 'network' | 'database' | 'pdf-parse' | 'email' | 'csv-parse';

export interface RuntimeCapabilities {
  environment: RuntimeEnvironment;
  capabilities: Set<Capability>;
  version?: string;
  platform?: string;
}

class RuntimeDetector {
  private static instance: RuntimeDetector;
  private capabilities: RuntimeCapabilities | null = null;

  static getInstance(): RuntimeDetector {
    if (!RuntimeDetector.instance) {
      RuntimeDetector.instance = new RuntimeDetector();
    }
    return RuntimeDetector.instance;
  }

  detectRuntime(): RuntimeCapabilities {
    if (this.capabilities) {
      return this.capabilities;
    }

    const capabilities = new Set<Capability>();
    let environment: RuntimeEnvironment = 'unknown';
    let version: string | undefined;
    let platform: string | undefined;

    // Detect environment
    if (typeof process !== 'undefined' && process.versions?.node) {
      environment = 'node';
      version = process.versions.node;
      platform = process.platform;

      // Node.js capabilities
      capabilities.add('file-system');
      capabilities.add('crypto');
      capabilities.add('network');
      capabilities.add('database');
      capabilities.add('pdf-parse');
      capabilities.add('email');
      capabilities.add('csv-parse');
    } else if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
      environment = 'edge';
      version = 'edge-runtime';
      
      // Edge Runtime capabilities (limited)
      capabilities.add('network');
      capabilities.add('crypto');
    } else if (typeof window !== 'undefined') {
      environment = 'browser';
      version = navigator.userAgent;
      platform = navigator.platform;

      // Browser capabilities (very limited)
      capabilities.add('network');
      capabilities.add('crypto');
    }

    this.capabilities = {
      environment,
      capabilities,
      version,
      platform
    };

    return this.capabilities;
  }

  hasCapability(capability: Capability): boolean {
    const runtime = this.detectRuntime();
    return runtime.capabilities.has(capability);
  }

  getEnvironment(): RuntimeEnvironment {
    return this.detectRuntime().environment;
  }

  isNode(): boolean {
    return this.getEnvironment() === 'node';
  }

  isEdge(): boolean {
    return this.getEnvironment() === 'edge';
  }

  isBrowser(): boolean {
    return this.getEnvironment() === 'browser';
  }

  getCapabilities(): Capability[] {
    const runtime = this.detectRuntime();
    return Array.from(runtime.capabilities);
  }

  getRuntimeInfo(): RuntimeCapabilities {
    return this.detectRuntime();
  }

  // Reset for testing
  reset(): void {
    this.capabilities = null;
  }
}

// Export singleton instance
export const runtimeDetector = RuntimeDetector.getInstance();

// Convenience functions
export const isNode = () => runtimeDetector.isNode();
export const isEdge = () => runtimeDetector.isEdge();
export const isBrowser = () => runtimeDetector.isBrowser();
export const hasCapability = (capability: Capability) => runtimeDetector.hasCapability(capability);
export const getRuntimeInfo = () => runtimeDetector.getRuntimeInfo();

// Runtime guard decorator
export function requireCapability(capability: Capability, toolName: string) {
  if (!hasCapability(capability)) {
    const runtime = getRuntimeInfo();
    throw new Error(
      `Tool '${toolName}' requires capability '${capability}' which is not available in ${runtime.environment} runtime. ` +
      `Available capabilities: ${runtime.capabilities.size > 0 ? Array.from(runtime.capabilities).join(', ') : 'none'}`
    );
  }
}

// Runtime guard for async functions
export function requireCapabilityAsync(capability: Capability, toolName: string) {
  return async function<T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value!;
    
    descriptor.value = async function(...args: T): Promise<R> {
      requireCapability(capability, toolName);
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}
