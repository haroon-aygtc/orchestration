# Agent architecture overview

_Automatically synced with your [v0.app](https://v0.app) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/haroons-projects-74f93423/v0-agent-architecture-overview)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/MxVRcQraxEa)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/haroons-projects-74f93423/v0-agent-architecture-overview](https://vercel.com/haroons-projects-74f93423/v0-agent-architecture-overview)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/MxVRcQraxEa](https://v0.app/chat/projects/MxVRcQraxEa)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## 🔧 Tool System Configuration

The enhanced tool registry system supports the following environment variables for production configuration:

### Cache Configuration

- `TOOL_CACHE_MAX_SIZE` - Maximum number of cached entries (default: 2000)
- `TOOL_CACHE_DEFAULT_TTL` - Default cache TTL in milliseconds (default: 300000 = 5 minutes)

### Timeout Configuration

- `TOOL_DEFAULT_TIMEOUT` - Default tool execution timeout (default: 30000ms = 30s)
- `TOOL_EMAIL_TIMEOUT` - Email sending timeout (default: 60000ms = 1min)
- `TOOL_SLACK_TIMEOUT` - Slack notification timeout (default: 30000ms = 30s)
- `TOOL_WEBHOOK_TIMEOUT` - Webhook trigger timeout (default: 45000ms = 45s)
- `TOOL_HTTP_TIMEOUT` - HTTP request timeout (default: 60000ms = 1min)
- `TOOL_CSV_TIMEOUT` - CSV parsing timeout (default: 120000ms = 2min)
- `TOOL_PDF_TIMEOUT` - PDF processing timeout (default: 120000ms = 2min)
- `TOOL_VALIDATOR_TIMEOUT` - Data validation timeout (default: 30000ms = 30s)
- `TOOL_HASH_TIMEOUT` - Hash generation timeout (default: 10000ms = 10s)
- `TOOL_JSON_TIMEOUT` - JSON validation timeout (default: 10000ms = 10s)
- `TOOL_FILE_TIMEOUT` - File operations timeout (default: 60000ms = 1min)
- `TOOL_DB_QUERY_TIMEOUT` - Database query timeout (default: 30000ms = 30s)
- `TOOL_DB_MUTATION_TIMEOUT` - Database mutation timeout (default: 30000ms = 30s)

### File System Configuration

- `TOOL_FILE_BASE_DIR` - Base directory for file operations (default: "./storage")
- `TOOL_FILE_MAX_BYTES` - Maximum file size in bytes (default: 10485760 = 10MB)

### Features

- ✅ Advanced caching with configurable TTL
- ✅ Schema validation with Zod
- ✅ Capability-based access control
- ✅ Built-in timeout management
- ✅ Production monitoring & metrics
- ✅ Singleflight deduplication
- ✅ Environment-based configuration
- ✅ Runtime capability detection
