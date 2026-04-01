-- Seed Categories Table
-- Insert standard project categories

INSERT INTO public.categories (name, description, icon, color) VALUES
  ('Technology', 'Software, apps, web platforms, and tech innovations', '💻', '#3B82F6'),
  ('Healthcare', 'Medical services, health tech, wellness initiatives', '🏥', '#EF4444'),
  ('Education', 'Learning platforms, courses, schools, and educational programs', '📚', '#10B981'),
  ('Environment', 'Sustainability, green energy, climate initiatives', '🌱', '#06B6D4'),
  ('Finance', 'Fintech, banking solutions, investment platforms', '💰', '#F59E0B'),
  ('Entertainment', 'Media, gaming, arts, music, content creation', '🎬', '#EC4899'),
  ('Agriculture', 'Farming, agritech, food production, supply chain', '🌾', '#92400E'),
  ('Real Estate', 'Property development, housing, commercial spaces', '🏢', '#6366F1'),
  ('E-commerce', 'Online retail, marketplaces, logistics', '🛍️', '#8B5CF6'),
  ('Transportation', 'Mobility solutions, logistics, automotive', '🚗', '#64748B'),
  ('Social Impact', 'Charitable causes, community development, NGO initiatives', '❤️', '#DC2626'),
  ('Other', 'Projects that do not fit standard categories', '📌', '#6B7280')
ON CONFLICT (name) DO NOTHING;
