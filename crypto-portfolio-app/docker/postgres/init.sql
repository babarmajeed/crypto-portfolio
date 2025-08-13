-- Initialize database
CREATE DATABASE crypto_portfolio;
CREATE USER crypto_user WITH ENCRYPTED PASSWORD 'crypto_password';
GRANT ALL PRIVILEGES ON DATABASE crypto_portfolio TO crypto_user;

-- Create extensions
\c crypto_portfolio;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";