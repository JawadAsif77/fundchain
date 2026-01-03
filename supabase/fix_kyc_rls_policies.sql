-- Fix RLS policies for user_verifications table to allow updates

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own verification" ON user_verifications;
DROP POLICY IF EXISTS "Users can insert own verification" ON user_verifications;
DROP POLICY IF EXISTS "Users can update own verification" ON user_verifications;
DROP POLICY IF EXISTS "Admins can view all verifications" ON user_verifications;
DROP POLICY IF EXISTS "Admins can update all verifications" ON user_verifications;

-- Enable RLS
ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own verification
CREATE POLICY "Users can view own verification"
ON user_verifications
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own verification
CREATE POLICY "Users can insert own verification"
ON user_verifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can UPDATE their own verification (THIS WAS MISSING OR WRONG)
CREATE POLICY "Users can update own verification"
ON user_verifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all verifications
CREATE POLICY "Admins can view all verifications"
ON user_verifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Admins can update all verifications
CREATE POLICY "Admins can update all verifications"
ON user_verifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_verifications'
ORDER BY policyname;
