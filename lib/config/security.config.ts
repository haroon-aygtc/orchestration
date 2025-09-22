// lib/config/security.config.ts
/**
 * Security Configuration
 * Centralized security settings and policies
 */

export interface SecurityConfig {
  webhooks: {
    enabled: boolean;
    secretKey: string;
    algorithms: string[];
    maxAge: number; // in seconds
  };
  domains: {
    allowed: string[];
    blocked: string[];
    wildcards: boolean;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  requestSize: {
    maxSize: number; // in bytes
    maxFiles: number;
    maxFields: number;
  };
  headers: {
    required: string[];
    forbidden: string[];
    custom: Record<string, string>;
  };
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    sensitiveFields: string[];
  };
}

export const defaultSecurityConfig: SecurityConfig = {
  webhooks: {
    enabled: process.env.WEBHOOK_SECURITY_ENABLED === 'true',
    secretKey: process.env.WEBHOOK_SECRET_KEY || 'default-secret-key-change-in-production',
    algorithms: ['sha256', 'sha1'],
    maxAge: 300, // 5 minutes
  },
  domains: {
    allowed: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      ...(process.env.ALLOWED_DOMAINS?.split(',') || [])
    ],
    blocked: [
      'malicious-site.com',
      'phishing-site.com',
      ...(process.env.BLOCKED_DOMAINS?.split(',') || [])
    ],
    wildcards: true,
  },
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  requestSize: {
    maxSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760'), // 10MB
    maxFiles: parseInt(process.env.MAX_FILES || '5'),
    maxFields: parseInt(process.env.MAX_FIELDS || '100'),
  },
  headers: {
    required: [
      'user-agent',
      'content-type'
    ],
    forbidden: [
      'x-forwarded-host',
      'x-originating-ip',
      'x-remote-ip',
      'x-remote-addr'
    ],
    custom: {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  },
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origins: [
      'http://localhost:3000',
      'http://localhost:3001',
      ...(process.env.CORS_ORIGINS?.split(',') || [])
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
  },
  logging: {
    enabled: process.env.SECURITY_LOGGING_ENABLED !== 'false',
    level: (process.env.SECURITY_LOG_LEVEL as any) || 'info',
    sensitiveFields: [
      'password',
      'token',
      'key',
      'secret',
      'auth',
      'credential',
      'api_key',
      'access_token',
      'refresh_token',
      'session_id',
      'ssn',
      'credit_card',
      'bank_account'
    ]
  }
};

// Environment-specific configurations
export const getSecurityConfig = (): SecurityConfig => {
  const env = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test' | 'staging';
  
  switch (env) {
    case 'production':
      return {
        ...defaultSecurityConfig,
        webhooks: {
          ...defaultSecurityConfig.webhooks,
          enabled: true,
          secretKey: process.env.WEBHOOK_SECRET_KEY || (() => {
            throw new Error('WEBHOOK_SECRET_KEY must be set in production');
          })(),
        },
        rateLimiting: {
          ...defaultSecurityConfig.rateLimiting,
          maxRequests: 50, // Stricter limits in production
        },
        requestSize: {
          ...defaultSecurityConfig.requestSize,
          maxSize: 5242880, // 5MB in production
        },
        logging: {
          ...defaultSecurityConfig.logging,
          level: 'warn',
        }
      };
      
    case 'staging':
      return {
        ...defaultSecurityConfig,
        rateLimiting: {
          ...defaultSecurityConfig.rateLimiting,
          maxRequests: 75,
        },
        requestSize: {
          ...defaultSecurityConfig.requestSize,
          maxSize: 8388608, // 8MB in staging
        }
      };
      
    case 'development':
    default:
      return {
        ...defaultSecurityConfig,
        webhooks: {
          ...defaultSecurityConfig.webhooks,
          enabled: false, // Disable in development
        },
        rateLimiting: {
          ...defaultSecurityConfig.rateLimiting,
          maxRequests: 1000, // More lenient in development
        },
        logging: {
          ...defaultSecurityConfig.logging,
          level: 'debug',
        }
      };
  }
};

// Security policy validation
export const validateSecurityConfig = (config: SecurityConfig): string[] => {
  const errors: string[] = [];
  
  // Validate webhook configuration
  if (config.webhooks.enabled) {
    if (!config.webhooks.secretKey || config.webhooks.secretKey === 'default-secret-key-change-in-production') {
      errors.push('Webhook secret key must be set when webhooks are enabled');
    }
    if (config.webhooks.algorithms.length === 0) {
      errors.push('At least one webhook algorithm must be specified');
    }
  }
  
  // Validate domain configuration
  if (config.domains.allowed.length === 0) {
    errors.push('At least one allowed domain must be specified');
  }
  
  // Validate rate limiting
  if (config.rateLimiting.enabled) {
    if (config.rateLimiting.windowMs <= 0) {
      errors.push('Rate limiting window must be positive');
    }
    if (config.rateLimiting.maxRequests <= 0) {
      errors.push('Rate limiting max requests must be positive');
    }
  }
  
  // Validate request size
  if (config.requestSize.maxSize <= 0) {
    errors.push('Maximum request size must be positive');
  }
  if (config.requestSize.maxFiles <= 0) {
    errors.push('Maximum files must be positive');
  }
  if (config.requestSize.maxFields <= 0) {
    errors.push('Maximum fields must be positive');
  }
  
  // Validate CORS
  if (config.cors.enabled) {
    if (config.cors.origins.length === 0) {
      errors.push('At least one CORS origin must be specified');
    }
    if (config.cors.methods.length === 0) {
      errors.push('At least one CORS method must be specified');
    }
  }
  
  return errors;
};

// Export the current configuration
export const securityConfig = getSecurityConfig();

// Validate configuration on load
const configErrors = validateSecurityConfig(securityConfig);
if (configErrors.length > 0) {
  console.error('Security configuration errors:', configErrors);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Invalid security configuration: ${configErrors.join(', ')}`);
  }
}
