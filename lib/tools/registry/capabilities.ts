// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/capabilities.ts
// Purpose: Capability map + public accessor
// ──────────────────────────────────────────────────────────────────────────────
export const toolCapabilities: Record<string, string[]> = {
    email_sender: ["email", "network"],
    http_request: ["network"],
    webhook_trigger: ["network"],
    slack_notify: ["network"],
    csv_parse: ["data-processing"],
    pdf_parse: ["data-processing", "file-system"],
    data_validator: ["validation", "custom"],
    hash_sha256: ["crypto"],
    json_validate: ["validation"],
    file_write: ["file-system"],
    db_query: ["database"],
    db_upsert: ["database"],
    db_create: ["database"],
    db_update: ["database"],
    db_delete: ["database"],
  };
  
  export const getToolCapabilities = () => toolCapabilities;
  
  