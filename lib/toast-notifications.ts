/**
 * Toast Notification System
 * Professional, user-friendly toast notifications for AI operations
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  actions?: ToastAction[];
  timestamp: Date;
}

export interface ToastAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

export class ToastManager {
  private static instance: ToastManager;
  private toasts: Toast[] = [];
  private listeners: Set<(toasts: Toast[]) => void> = new Set();
  private nextId = 1;

  static getInstance(): ToastManager {
    if (!this.instance) {
      this.instance = new ToastManager();
    }
    return this.instance;
  }

  /**
   * Subscribe to toast updates
   */
  subscribe(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.toasts); // Send current toasts immediately
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Add a new toast
   */
  add(toast: Omit<Toast, 'id' | 'timestamp'>): string {
    const id = `toast-${this.nextId++}`;
    const newToast: Toast = {
      ...toast,
      id,
      timestamp: new Date(),
      duration: toast.duration ?? this.getDefaultDuration(toast.type)
    };

    this.toasts.push(newToast);
    this.notifyListeners();

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, newToast.duration);
    }

    return id;
  }

  /**
   * Remove a toast by ID
   */
  remove(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  /**
   * Get all current toasts
   */
  getAll(): Toast[] {
    return [...this.toasts];
  }

  /**
   * AI Provider specific toast methods
   */
  static aiProvider = {
    /**
     * API key validation success
     */
    keyValidated: (provider: string) => ({
      type: 'success' as const,
      title: 'API Key Validated',
      message: `${provider} API key is valid and working correctly`,
      duration: 4000
    }),

    /**
     * API key validation failed
     */
    keyValidationFailed: (provider: string, error: string) => ({
      type: 'error' as const,
      title: 'API Key Invalid',
      message: `Failed to validate ${provider} API key: ${error}`,
      duration: 6000
    }),

    /**
     * Connection test success
     */
    connectionSuccess: (provider: string, responseTime: number) => ({
      type: 'success' as const,
      title: 'Connection Successful',
      message: `Successfully connected to ${provider} (${responseTime}ms)`,
      duration: 4000
    }),

    /**
     * Connection test failed
     */
    connectionFailed: (provider: string, error: string) => ({
      type: 'error' as const,
      title: 'Connection Failed',
      message: `Failed to connect to ${provider}: ${error}`,
      duration: 6000
    }),

    /**
     * Model not available
     */
    modelUnavailable: (provider: string, model: string) => ({
      type: 'warning' as const,
      title: 'Model Unavailable',
      message: `Model ${model} is not available for ${provider}`,
      duration: 5000
    }),

    /**
     * Rate limit warning
     */
    rateLimitWarning: (provider: string, remaining: number) => ({
      type: 'warning' as const,
      title: 'Rate Limit Warning',
      message: `Only ${remaining} requests remaining for ${provider}`,
      duration: 5000
    }),

    /**
     * Configuration saved
     */
    configSaved: (provider: string) => ({
      type: 'success' as const,
      title: 'Configuration Saved',
      message: `${provider} configuration has been saved successfully`,
      duration: 3000
    }),

    /**
     * Configuration save failed
     */
    configSaveFailed: (provider: string, error: string) => ({
      type: 'error' as const,
      title: 'Save Failed',
      message: `Failed to save ${provider} configuration: ${error}`,
      duration: 6000
    }),

    /**
     * Testing in progress
     */
    testingInProgress: (provider: string) => ({
      type: 'loading' as const,
      title: 'Testing Connection',
      message: `Testing ${provider} API connection...`,
      duration: 0 // Don't auto-remove loading toasts
    }),

    /**
     * Agent test success
     */
    agentTestSuccess: (agentName: string, responseTime: number) => ({
      type: 'success' as const,
      title: 'Agent Test Successful',
      message: `${agentName} agent is working correctly (${responseTime}ms)`,
      duration: 4000
    }),

    /**
     * Agent test failed
     */
    agentTestFailed: (agentName: string, error: string) => ({
      type: 'error' as const,
      title: 'Agent Test Failed',
      message: `${agentName} agent test failed: ${error}`,
      duration: 6000
    })
  };

  /**
   * General purpose toast methods
   */
  static general = {
    /**
     * Success message
     */
    success: (title: string, message: string, duration = 4000) => ({
      type: 'success' as const,
      title,
      message,
      duration
    }),

    /**
     * Error message
     */
    error: (title: string, message: string, duration = 6000) => ({
      type: 'error' as const,
      title,
      message,
      duration
    }),

    /**
     * Warning message
     */
    warning: (title: string, message: string, duration = 5000) => ({
      type: 'warning' as const,
      title,
      message,
      duration
    }),

    /**
     * Info message
     */
    info: (title: string, message: string, duration = 4000) => ({
      type: 'info' as const,
      title,
      message,
      duration
    }),

    /**
     * Loading message
     */
    loading: (title: string, message: string) => ({
      type: 'loading' as const,
      title,
      message,
      duration: 0
    })
  };

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  private getDefaultDuration(type: ToastType): number {
    switch (type) {
      case 'success': return 4000;
      case 'error': return 6000;
      case 'warning': return 5000;
      case 'info': return 4000;
      case 'loading': return 0; // Don't auto-remove loading toasts
      default: return 4000;
    }
  }
}

// Export singleton instance
export const toastManager = ToastManager.getInstance();
