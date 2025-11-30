# wrangler.toml - Cloudflare Workers Configuration (Wrangler v4 Compatible)

# Worker name (will be your subdomain: telegram-user-api.yourname.workers.dev)
name = "telegram-user-api"

# Entry point file
main = "worker.js"

# Compatibility date - use latest features
compatibility_date = "2025-11-30"

# Compatibility flags (if you need Node.js APIs, uncomment below)
# compatibility_flags = ["nodejs_compat"]

# Enable workers.dev subdomain for testing
workers_dev = true

# Environment variables (non-sensitive)
[vars]
API_VERSION = "3.0"
MAX_PHOTOS = "100"
ENABLE_CORS = "true"

# For production environment
[env.production]
name = "telegram-user-api-prod"
[env.production.vars]
API_VERSION = "3.0"
ENABLE_LOGGING = "true"

# For staging/testing environment
[env.staging]
name = "telegram-user-api-staging"
[env.staging.vars]
API_VERSION = "3.0-beta"
ENABLE_LOGGING = "true"
DEBUG = "true"

# For development environment
[env.dev]
name = "telegram-user-api-dev"
[env.dev.vars]
DEBUG = "true"
VERBOSE_ERRORS = "true"
