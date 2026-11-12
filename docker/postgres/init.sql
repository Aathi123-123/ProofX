-- PostgreSQL initialization script for PSDE
-- This runs once when the container first starts.

-- Ensure extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant all privileges to psde_user
GRANT ALL PRIVILEGES ON DATABASE psde_db TO psde_user;
