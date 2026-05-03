-- AWPB Database Schema
-- Based on frontend data structures and requirements

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE user_role AS ENUM ('admin', 'encoder');
CREATE TYPE user_status AS ENUM ('active', 'deactivated');
CREATE TYPE entry_status AS ENUM ('draft', 'submitted', 'Pending Review', 'Returned', 'Approved', 'Rejected');
CREATE TYPE month_type AS ENUM ('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'encoder')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('active', 'deactivated')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units table
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    aliases JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Components table
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub_Components table
CREATE TABLE sub_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key_Activities table
CREATE TABLE key_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sub_component_id UUID NOT NULL REFERENCES sub_components(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    activity_no INTEGER,
    performance_indicator TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub_Activities table
CREATE TABLE sub_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_activity_id UUID NOT NULL REFERENCES key_activities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entries table (AWPB Entries)
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id),
    planning_year INTEGER NOT NULL,
    component_id UUID NOT NULL REFERENCES components(id),
    sub_component_id UUID NOT NULL REFERENCES sub_components(id),
    key_activity_id UUID NOT NULL REFERENCES key_activities(id),
    sub_activity_id UUID REFERENCES sub_activities(id), -- Nullable
    title_of_activities TEXT NOT NULL,
    unit_cost DECIMAL(12,2) DEFAULT 0,
    status entry_status DEFAULT 'approved','pending','rejected','revision',
    submission_date TIMESTAMPTZ,
    review_date TIMESTAMPTZ,
    reviewer_id UUID REFERENCES users(id), -- Nullable
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly_Targets table
CREATE TABLE monthly_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    month month_type NOT NULL,
    target_quantity DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entry_id, month) -- Ensure one target per month per entry
);

-- Submission_Windows table
CREATE TABLE submission_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_units_code ON units(code);
CREATE INDEX idx_components_code ON components(code);
CREATE INDEX idx_sub_components_component_id ON sub_components(component_id);
CREATE INDEX idx_sub_components_code ON sub_components(code);
CREATE INDEX idx_key_activities_sub_component_id ON key_activities(sub_component_id);
CREATE INDEX idx_key_activities_code ON key_activities(code);
CREATE INDEX idx_sub_activities_key_activity_id ON sub_activities(key_activity_id);
CREATE INDEX idx_entries_owner_id ON entries(owner_id);
CREATE INDEX idx_entries_unit_id ON entries(unit_id);
CREATE INDEX idx_entries_planning_year ON entries(planning_year);
CREATE INDEX idx_entries_status ON entries(status);
CREATE INDEX idx_entries_component_id ON entries(component_id);
CREATE INDEX idx_entries_sub_component_id ON entries(sub_component_id);
CREATE INDEX idx_entries_key_activity_id ON entries(key_activity_id);
CREATE INDEX idx_monthly_targets_entry_id ON monthly_targets(entry_id);
CREATE INDEX idx_monthly_targets_month ON monthly_targets(month);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_targets_updated_at BEFORE UPDATE ON monthly_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data
-- Units
INSERT INTO units (code, name, aliases) VALUES
('RCU', 'Regional Coordinating Unit', '["RCU"]'),
('BKD', 'Bukidnon', '["BKD"]'),
('LDN', 'Lanao del Norte', '["LDN"]'),
('MIS OR', 'Misamis Oriental', '["MIS OR"]');

-- Components (from frontend data)
INSERT INTO components (name, code, sort_order) VALUES
('COMPONENT 1: DIRECT ASSISTANCE TO ENTERPRISE', 'COMPONENT_1', 1),
('COMPONENT 2: PROJECT MANAGEMENT', 'COMPONENT_2', 2),
('COMPONENT 3: CAPACITY BUILDING', 'COMPONENT_3', 3),
('COMPONENT 4: INNOVATIVE FINANCING', 'COMPONENT_4', 4);

-- Default users (password: password123)
INSERT INTO users (username, full_name, email, password_hash, role, status) VALUES
('enc_user', 'Default Encoder', 'encoder@dti.gov.ph', '$2b$10$rQZ8ZHWKZQZQZQZQZQZQZOZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'encoder', 'active'),
('adm_admin', 'Default Admin', 'admin@dti.gov.ph', '$2b$10$rQZ8ZHWKZQZQZQZQZQZQZOZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'admin', 'active');

-- Default submission window
INSERT INTO submission_windows (title, start_date, end_date, is_active) VALUES
('FY 2026 Submission Window', '2026-04-01', '2026-04-30', true);

-- Create view for template hierarchy (for frontend consumption)
CREATE OR REPLACE VIEW template_hierarchy AS
SELECT 
    c.id as component_id,
    c.name as component,
    c.code as component_code,
    sc.id as sub_component_id,
    sc.name as sub_component,
    sc.code as sub_component_code,
    ka.id as key_activity_id,
    ka.name as key_activity,
    ka.code as key_activity_code,
    ka.activity_no,
    ka.performance_indicator,
    sa.id as sub_activity_id,
    sa.name as sub_activity,
    sa.code as sub_activity_code,
    ka.sort_order
FROM components c
LEFT JOIN sub_components sc ON c.id = sc.component_id AND sc.is_active = true
LEFT JOIN key_activities ka ON sc.id = ka.sub_component_id AND ka.is_active = true
LEFT JOIN sub_activities sa ON ka.id = sa.key_activity_id AND sa.is_active = true
WHERE c.is_active = true
ORDER BY c.sort_order, sc.sort_order, ka.sort_order, sa.sort_order;

-- Create view for entries with monthly targets
CREATE VIEW entries_with_targets AS
SELECT 
    e.*,
    json_agg(
        json_build_object(
            'month', mt.month,
            'target_quantity', mt.target_quantity
        ) ORDER BY mt.month
    ) as monthly_targets
FROM entries e
LEFT JOIN monthly_targets mt ON e.id = mt.entry_id
GROUP BY e.id, e.owner_id, e.unit_id, e.planning_year, e.component_id, 
         e.sub_component_id, e.key_activity_id, e.sub_activity_id,
         e.title_of_activities, e.unit_cost, e.status, e.submission_date,
         e.review_date, e.reviewer_id, e.reviewer_notes, e.created_at, e.updated_at
ORDER BY e.created_at DESC;
