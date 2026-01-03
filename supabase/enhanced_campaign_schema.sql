-- Enhanced Campaign Creation Schema
-- Add new fields for transparency and trust building

-- Add new columns to campaigns table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_image_url text,
  ADD COLUMN IF NOT EXISTS team_size integer,
  ADD COLUMN IF NOT EXISTS team_experience text,
  ADD COLUMN IF NOT EXISTS project_stage text CHECK (project_stage IN ('idea', 'prototype', 'mvp', 'launched', 'scaling')),
  ADD COLUMN IF NOT EXISTS use_of_funds jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expected_roi text,
  ADD COLUMN IF NOT EXISTS market_analysis text,
  ADD COLUMN IF NOT EXISTS competitive_advantage text,
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS revenue_streams text,
  ADD COLUMN IF NOT EXISTS milestones_description text,
  ADD COLUMN IF NOT EXISTS risks_and_challenges text,
  ADD COLUMN IF NOT EXISTS social_media_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS video_pitch_url text,
  ADD COLUMN IF NOT EXISTS pitch_deck_url text,
  ADD COLUMN IF NOT EXISTS whitepaper_url text,
  ADD COLUMN IF NOT EXISTS github_repository text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS legal_structure text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS previous_funding_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS previous_funding_source text,
  ADD COLUMN IF NOT EXISTS is_updatable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS update_count integer DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_project_stage ON campaigns(project_stage);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_updatable ON campaigns(is_updatable);
CREATE INDEX IF NOT EXISTS idx_campaigns_last_updated ON campaigns(last_updated_at);

-- Add comments for documentation
COMMENT ON COLUMN campaigns.campaign_image_url IS 'Main campaign banner/hero image';
COMMENT ON COLUMN campaigns.team_size IS 'Number of team members';
COMMENT ON COLUMN campaigns.team_experience IS 'Brief about team experience and expertise';
COMMENT ON COLUMN campaigns.project_stage IS 'Current stage of the project';
COMMENT ON COLUMN campaigns.use_of_funds IS 'Detailed breakdown of how funds will be used';
COMMENT ON COLUMN campaigns.expected_roi IS 'Expected return on investment timeline';
COMMENT ON COLUMN campaigns.market_analysis IS 'Market size and opportunity analysis';
COMMENT ON COLUMN campaigns.competitive_advantage IS 'What makes this project unique';
COMMENT ON COLUMN campaigns.target_audience IS 'Description of target users/customers';
COMMENT ON COLUMN campaigns.business_model IS 'How the business will make money';
COMMENT ON COLUMN campaigns.revenue_streams IS 'Sources of revenue';
COMMENT ON COLUMN campaigns.risks_and_challenges IS 'Potential risks and mitigation strategies';
COMMENT ON COLUMN campaigns.social_media_links IS 'JSON object with social media URLs';
COMMENT ON COLUMN campaigns.is_updatable IS 'Whether creator can still update this campaign';
COMMENT ON COLUMN campaigns.last_updated_at IS 'Last time campaign was updated before approval';
COMMENT ON COLUMN campaigns.update_count IS 'Number of times campaign was updated before approval';

-- Update RLS policies to allow updates for pending campaigns
DROP POLICY IF EXISTS "Creators can update own pending campaigns" ON campaigns;

CREATE POLICY "Creators can update own pending campaigns"
ON campaigns
FOR UPDATE
USING (
  auth.uid() = creator_id 
  AND status = 'pending_review'
  AND is_updatable = true
)
WITH CHECK (
  auth.uid() = creator_id 
  AND status = 'pending_review'
);

-- Create storage bucket policies (run this separately in Storage section)
-- Bucket name: campaign-images
-- Public: Yes
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- RLS policies for campaign-images bucket:
-- Policy 1: Anyone can view
-- INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-images', 'campaign-images', true);

-- Policy 2: Users can upload to their own folder
-- CREATE POLICY "Users can upload campaign images"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'campaign-images' 
--   AND (storage.foldername(name))[1] = auth.uid()::text
-- );

-- Policy 3: Users can update their own images
-- CREATE POLICY "Users can update own campaign images"
-- ON storage.objects FOR UPDATE
-- USING (
--   bucket_id = 'campaign-images' 
--   AND (storage.foldername(name))[1] = auth.uid()::text
-- );

-- Policy 4: Users can delete their own images
-- CREATE POLICY "Users can delete own campaign images"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'campaign-images' 
--   AND (storage.foldername(name))[1] = auth.uid()::text
-- );
