-- ========================================================
-- AL PARFUME - SUPABASE MIGRATION: TABEL SITE_VISITS (ANALITIK)
-- ========================================================

CREATE TABLE IF NOT EXISTS site_visits (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(128) NOT NULL,
    path VARCHAR(255) NOT NULL,
    referrer VARCHAR(255) DEFAULT 'direct',
    device_type VARCHAR(32) DEFAULT 'desktop',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for high-performance analytics aggregation
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_session_id ON site_visits (session_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_path ON site_visits (path);

-- Row Level Security (RLS)
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- Note: Anonymous users cannot read site_visits (SELECT is restricted).
-- Data is only accessed via getServiceClient() with verifyAdminSession on admin API routes.
