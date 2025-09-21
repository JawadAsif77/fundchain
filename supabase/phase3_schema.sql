-- =============================================================================
-- PHASE 3 DATABASE SCHEMA ADDITIONS
-- =============================================================================
-- Additional tables and modifications for Phase 3: Onboarding + KYC + Projects
-- Version: Phase 3 (September 2025)
-- 
-- This adds:
-- - Role-based user system
-- - Company/Business verification (KYC)
-- - Project management system
-- - Enhanced investment flow
-- - Milestone tracking
-- =============================================================================

-- =============================================================================
-- PHASE 3 ENUMS
-- =============================================================================

-- User roles for role-based access
CREATE TYPE user_role AS ENUM ('investor', 'creator');

-- Project status enumeration
CREATE TYPE project_status AS ENUM ('draft', 'live', 'completed', 'cancelled');

-- Document types for KYC and projects
CREATE TYPE document_type AS ENUM ('business_registration', 'id_document', 'business_plan', 'financial_projection', 'team_info', 'other');

-- =============================================================================
-- ADD ROLE COLUMN TO EXISTING USERS TABLE
-- =============================================================================

-- Add role column to existing users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role user_role;

-- =============================================================================
-- PHASE 3 NEW TABLES
-- =============================================================================

-- Companies table for business verification (KYC)
CREATE TABLE public.companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    registration_number TEXT,
    country TEXT NOT NULL,
    website TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verification_notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table (enhanced version of campaigns for Phase 3)
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    summary TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    goal_amount DECIMAL(15,2) NOT NULL CHECK (goal_amount > 0),
    current_raised DECIMAL(15,2) DEFAULT 0,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status project_status DEFAULT 'draft',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_deadline CHECK (deadline > created_at),
    CONSTRAINT valid_raised CHECK (current_raised >= 0),
    CONSTRAINT valid_raised_vs_goal CHECK (current_raised <= goal_amount)
);

-- Project milestones for funding stages
CREATE TABLE public.project_milestones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    milestone_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    payout_percentage DECIMAL(5,2) NOT NULL CHECK (payout_percentage > 0 AND payout_percentage <= 100),
    target_amount DECIMAL(15,2),
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique milestone index per project
    UNIQUE(project_id, milestone_index)
);

-- Enhanced investments table for projects (separate from existing campaigns)
CREATE TABLE public.project_investments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    investor_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'completed', 'cancelled')),
    payment_method TEXT,
    payment_reference TEXT,
    investment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    
    -- Note: Self-investment prevention will be handled at application level
    -- through RLS policies and frontend validation
);

-- Document management for KYC and projects
CREATE TABLE public.project_docs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Either project_id OR company_id must be set
    CONSTRAINT doc_belongs_to_project_or_company CHECK (
        (project_id IS NOT NULL AND company_id IS NULL) OR
        (project_id IS NULL AND company_id IS NOT NULL)
    )
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Companies indexes
CREATE INDEX idx_companies_owner ON public.companies(owner_id);
CREATE INDEX idx_companies_verified ON public.companies(verified);

-- Projects indexes
CREATE INDEX idx_projects_creator ON public.projects(creator_id);
CREATE INDEX idx_projects_company ON public.projects(company_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_category ON public.projects(category);
CREATE INDEX idx_projects_deadline ON public.projects(deadline);
CREATE INDEX idx_projects_slug ON public.projects(slug);

-- Project milestones indexes
CREATE INDEX idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_project_milestones_index ON public.project_milestones(project_id, milestone_index);

-- Project investments indexes
CREATE INDEX idx_project_investments_project ON public.project_investments(project_id);
CREATE INDEX idx_project_investments_investor ON public.project_investments(investor_id);
CREATE INDEX idx_project_investments_status ON public.project_investments(status);
CREATE INDEX idx_project_investments_date ON public.project_investments(investment_date);

-- Project docs indexes
CREATE INDEX idx_project_docs_project ON public.project_docs(project_id);
CREATE INDEX idx_project_docs_company ON public.project_docs(company_id);
CREATE INDEX idx_project_docs_type ON public.project_docs(document_type);

-- Users role index
CREATE INDEX idx_users_role ON public.users(role);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update project funding when investment is completed
CREATE OR REPLACE FUNCTION update_project_funding()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        -- Add to project funding
        UPDATE public.projects 
        SET current_raised = current_raised + NEW.amount
        WHERE id = NEW.project_id;
        
    ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        -- Remove from project funding (cancellation case)
        UPDATE public.projects 
        SET current_raised = current_raised - OLD.amount
        WHERE id = OLD.project_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate milestone percentages
CREATE OR REPLACE FUNCTION validate_milestone_percentages()
RETURNS TRIGGER AS $$
DECLARE
    total_percentage DECIMAL(5,2);
BEGIN
    -- Calculate total percentage for the project
    SELECT COALESCE(SUM(payout_percentage), 0) 
    INTO total_percentage
    FROM public.project_milestones 
    WHERE project_id = NEW.project_id;
    
    -- Check if total would exceed 100%
    IF total_percentage > 100 THEN
        RAISE EXCEPTION 'Total milestone percentages cannot exceed 100%%. Current total would be: %', total_percentage;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column_phase3()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER CREATION
-- =============================================================================

-- Project funding update trigger
CREATE TRIGGER update_project_funding_trigger
    AFTER INSERT OR UPDATE ON public.project_investments
    FOR EACH ROW EXECUTE FUNCTION update_project_funding();

-- Milestone percentage validation trigger
CREATE TRIGGER validate_milestone_percentages_trigger
    BEFORE INSERT OR UPDATE ON public.project_milestones
    FOR EACH ROW EXECUTE FUNCTION validate_milestone_percentages();

-- Updated_at triggers for new tables
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON public.companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_phase3();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON public.projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_phase3();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_docs ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Users can view their own company" ON public.companies
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own company" ON public.companies
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own company" ON public.companies
    FOR UPDATE USING (auth.uid() = owner_id);

-- Projects policies
CREATE POLICY "Anyone can view live projects" ON public.projects
    FOR SELECT USING (status IN ('live', 'completed'));

CREATE POLICY "Creators can view their own projects" ON public.projects
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Verified creators can create projects" ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() = creator_id AND
        EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.id = company_id AND c.owner_id = auth.uid() AND c.verified = true
        )
    );

CREATE POLICY "Creators can update their own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = creator_id);

-- Project milestones policies
CREATE POLICY "Anyone can view milestones of live projects" ON public.project_milestones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND p.status IN ('live', 'completed')
        )
    );

CREATE POLICY "Creators can manage their project milestones" ON public.project_milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND p.creator_id = auth.uid()
        )
    );

-- Project investments policies
CREATE POLICY "Investors can view their own investments" ON public.project_investments
    FOR SELECT USING (auth.uid() = investor_id);

CREATE POLICY "Project creators can view investments in their projects" ON public.project_investments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND p.creator_id = auth.uid()
        )
    );

CREATE POLICY "Investors can create investments" ON public.project_investments
    FOR INSERT WITH CHECK (
        auth.uid() = investor_id AND
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() AND u.role = 'investor'
        ) AND
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND p.status = 'live'
        ) AND
        NOT EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND p.creator_id = auth.uid()
        )
    );

CREATE POLICY "Investors can update their own investments" ON public.project_investments
    FOR UPDATE USING (auth.uid() = investor_id);

-- Project docs policies
CREATE POLICY "Company owners can manage their docs" ON public.project_docs
    FOR ALL USING (
        (company_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.id = company_id AND c.owner_id = auth.uid()
        )) OR
        (project_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id AND p.creator_id = auth.uid()
        ))
    );

-- =============================================================================
-- VIEWS FOR EASIER QUERYING
-- =============================================================================

-- Public projects view with calculated fields
CREATE VIEW public_projects AS
SELECT 
    p.*,
    c.name as company_name,
    u.full_name as creator_name,
    u.avatar_url as creator_avatar,
    ROUND((p.current_raised / p.goal_amount) * 100, 2) as funding_percentage,
    EXTRACT(DAYS FROM (p.deadline - NOW())) as days_remaining,
    COUNT(DISTINCT pi.id) as investor_count
FROM public.projects p
LEFT JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.users u ON p.creator_id = u.id
LEFT JOIN public.project_investments pi ON p.id = pi.project_id AND pi.status = 'completed'
WHERE p.status IN ('live', 'completed')
GROUP BY p.id, c.name, u.full_name, u.avatar_url;

-- User portfolio view
CREATE VIEW user_portfolio AS
SELECT 
    pi.*,
    p.title as project_title,
    p.image_url as project_image,
    p.status as project_status,
    p.current_raised,
    p.goal_amount,
    ROUND((p.current_raised / p.goal_amount) * 100, 2) as funding_percentage
FROM public.project_investments pi
JOIN public.projects p ON pi.project_id = p.id
WHERE pi.status = 'completed';

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert default project categories (if not exists)
-- These can be used for project categorization

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.companies IS 'Business verification and KYC information for creators';
COMMENT ON TABLE public.projects IS 'Crowdfunding projects created by verified businesses';
COMMENT ON TABLE public.project_milestones IS 'Funding milestones for project payout stages';
COMMENT ON TABLE public.project_investments IS 'Investor investments in specific projects';
COMMENT ON TABLE public.project_docs IS 'Document storage for KYC and project materials';

COMMENT ON VIEW public_projects IS 'Public view of live projects with calculated metrics';
COMMENT ON VIEW user_portfolio IS 'User investment portfolio with project details';

-- =============================================================================
-- END OF PHASE 3 SCHEMA ADDITIONS
-- =============================================================================