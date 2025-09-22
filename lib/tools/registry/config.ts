// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/config.ts
// Purpose: Config validation
// ──────────────────────────────────────────────────────────────────────────────
export const validateToolConfiguration = () => {
    const config = {
      cacheMaxSize: parseInt(process.env.TOOL_CACHE_MAX_SIZE || "2000"),
      cacheDefaultTtl: parseInt(process.env.TOOL_CACHE_DEFAULT_TTL || "300000"),
      defaultTimeout: parseInt(process.env.TOOL_DEFAULT_TIMEOUT || "30000"),
      fileMaxSize: parseInt(process.env.TOOL_FILE_MAX_BYTES || "10485760"),
    };
    const warnings: string[] = []; const errors: string[] = [];
    if (config.cacheMaxSize <= 0) errors.push("TOOL_CACHE_MAX_SIZE must be > 0");
    if (config.cacheMaxSize > 10000) warnings.push("TOOL_CACHE_MAX_SIZE is very high (>10k), consider memory usage");
    if (config.defaultTimeout <= 1000) warnings.push("TOOL_DEFAULT_TIMEOUT is very low (<1s)");
    if (config.defaultTimeout > 300000) warnings.push("TOOL_DEFAULT_TIMEOUT is very high (>5min)");
    if (config.fileMaxSize <= 1024) warnings.push("TOOL_FILE_MAX_BYTES is very low (<1KB)");
    if (config.fileMaxSize > 100 * 1024 * 1024) warnings.push("TOOL_FILE_MAX_BYTES is very high (>100MB)");
    return { config, warnings, errors, isValid: errors.length === 0 };
  };
  