/**
 * AI Provider API Key Validator
 * Production-grade API key validation for all supported providers
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  provider?: string;
  keyType?: string;
}

export interface APIKeyInfo {
  provider: string;
  keyType: string;
  isValid: boolean;
  format: string;
  length: number;
  prefix: string;
}

export class APIKeyValidator {
  private static readonly PATTERNS = {
    openai: {
      pattern: /^sk-[a-zA-Z0-9]{48}$/,
      prefix: 'sk-',
      minLength: 51,
      maxLength: 51,
      description: 'OpenAI API Key (sk-...48 chars)'
    },
    anthropic: {
      pattern: /^sk-ant-[a-zA-Z0-9]{32}$/,
      prefix: 'sk-ant-',
      minLength: 39,
      maxLength: 39,
      description: 'Anthropic API Key (sk-ant-...32 chars)'
    },
    groq: {
      pattern: /^gsk_[a-zA-Z0-9]{32}$/,
      prefix: 'gsk_',
      minLength: 36,
      maxLength: 36,
      description: 'Groq API Key (gsk_...32 chars)'
    },
    openrouter: {
      pattern: /^sk-or-v1-[a-zA-Z0-9]{64}$/,
      prefix: 'sk-or-v1-',
      minLength: 74,
      maxLength: 74,
      description: 'OpenRouter API Key (sk-or-v1-...64 chars)'
    },
    gemini: {
      pattern: /^AIza[a-zA-Z0-9_-]{35}$/,
      prefix: 'AIza',
      minLength: 39,
      maxLength: 39,
      description: 'Google Gemini API Key (AIza...35 chars)'
    },
    mistral: {
      pattern: /^[a-zA-Z0-9]{32}$/,
      prefix: '',
      minLength: 32,
      maxLength: 32,
      description: 'Mistral AI API Key (32 alphanumeric chars)'
    },
    deepseek: {
      pattern: /^sk-[a-zA-Z0-9]{48}$/,
      prefix: 'sk-',
      minLength: 51,
      maxLength: 51,
      description: 'DeepSeek API Key (sk-...48 chars)'
    },
    codestral: {
      pattern: /^[a-zA-Z0-9]{32}$/,
      prefix: '',
      minLength: 32,
      maxLength: 32,
      description: 'CodeStral API Key (32 alphanumeric chars)'
    }
  } as const;

  /**
   * Validate API key format for a specific provider
   */
  static validateFormat(provider: string, apiKey: string): ValidationResult {
    const normalizedProvider = provider.toLowerCase();
    const pattern = this.PATTERNS[normalizedProvider as keyof typeof this.PATTERNS];

    if (!pattern) {
      return {
        isValid: false,
        error: `Unsupported provider: ${provider}. Supported providers: ${Object.keys(this.PATTERNS).join(', ')}`
      };
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return {
        isValid: false,
        error: 'API key is required and must be a string'
      };
    }

    // Check length
    if (apiKey.length < pattern.minLength || apiKey.length > pattern.maxLength) {
      return {
        isValid: false,
        error: `Invalid API key length. Expected ${pattern.minLength} characters, got ${apiKey.length}`
      };
    }

    // Check format
    if (!pattern.pattern.test(apiKey)) {
      return {
        isValid: false,
        error: `Invalid API key format. Expected format: ${pattern.description}`
      };
    }

    return {
      isValid: true,
      provider: normalizedProvider,
      keyType: pattern.description
    };
  }

  /**
   * Get API key information without validation
   */
  static getKeyInfo(apiKey: string): APIKeyInfo | null {
    if (!apiKey || typeof apiKey !== 'string') {
      return null;
    }

    for (const [provider, pattern] of Object.entries(this.PATTERNS)) {
      if (pattern.pattern.test(apiKey)) {
        return {
          provider,
          keyType: pattern.description,
          isValid: true,
          format: pattern.description,
          length: apiKey.length,
          prefix: pattern.prefix
        };
      }
    }

    return {
      provider: 'unknown',
      keyType: 'Unknown format',
      isValid: false,
      format: 'Unknown',
      length: apiKey.length,
      prefix: apiKey.substring(0, 8) + '...'
    };
  }

  /**
   * Validate API key for any supported provider
   */
  static validateAnyProvider(apiKey: string): ValidationResult {
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        isValid: false,
        error: 'API key is required and must be a string'
      };
    }

    for (const provider of Object.keys(this.PATTERNS)) {
      const result = this.validateFormat(provider, apiKey);
      if (result.isValid) {
        return result;
      }
    }

    return {
      isValid: false,
      error: 'API key does not match any supported provider format'
    };
  }

  /**
   * Get supported providers list
   */
  static getSupportedProviders(): string[] {
    return Object.keys(this.PATTERNS);
  }

  /**
   * Get provider pattern information
   */
  static getProviderInfo(provider: string) {
    const normalizedProvider = provider.toLowerCase();
    return this.PATTERNS[normalizedProvider as keyof typeof this.PATTERNS] || null;
  }

  /**
   * Mask API key for logging (shows first 8 chars + ...)
   */
  static maskKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
      return '***';
    }
    return apiKey.substring(0, 8) + '...';
  }

  /**
   * Check if API key looks like it might be valid (basic checks)
   */
  static isLikelyValid(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic length check
    if (apiKey.length < 20 || apiKey.length > 100) {
      return false;
    }

    // Check if it starts with known prefixes
    const knownPrefixes = ['sk-', 'sk-ant-', 'gsk_'];
    return knownPrefixes.some(prefix => apiKey.startsWith(prefix));
  }
}
