-- =============================================================================
-- AUTO-CREATE USER PROFILE TRIGGER
-- =============================================================================
-- This trigger automatically creates a user profile in public.users
-- when a new user is created in auth.users
-- =============================================================================

-- Function to create user profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert new user into public.users table
  INSERT INTO public.users (id, email, full_name, role, is_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'investor'),
    'no'
  )
  ON CONFLICT (id) DO NOTHING; -- Avoid duplicate inserts
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle the case where email is confirmed
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Check if email was just confirmed (email_confirmed_at changed from null to not null)
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    -- Ensure user profile exists
    INSERT INTO public.users (id, email, full_name, username, role, is_verified)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'username', NULL),
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'investor'),
      'no'
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, users.full_name),
      username = COALESCE(EXCLUDED.username, users.username),
      role = COALESCE(EXCLUDED.role, users.role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for email confirmation
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();