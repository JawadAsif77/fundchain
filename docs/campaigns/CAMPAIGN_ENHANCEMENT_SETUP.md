# Campaign Creation Enhancement - Setup Guide

## Overview
This document contains all setup steps for the enhanced campaign creation system with image uploads, comprehensive fields, validation, and update capabilities.

## ✅ Part 1: Database Migration (REQUIRED)

### Step 1: Run Enhanced Schema SQL
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Open the file: `supabase/enhanced_campaign_schema.sql`
4. Execute the SQL script
5. Verify columns added successfully:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'campaigns';
   ```

### Expected New Columns:
- campaign_image_url (text)
- team_size (integer)
- team_experience (text)
- project_stage (text)
- use_of_funds (jsonb)
- expected_roi (text)
- market_analysis (text)
- competitive_advantage (text)
- target_audience (text)
- business_model (text)
- revenue_streams (text)
- risks_and_challenges (text)
- social_media_links (jsonb)
- video_pitch_url (text)
- pitch_deck_url (text)
- whitepaper_url (text)
- website_url (text)
- github_repository (text)
- legal_structure (text)
- registration_number (text)
- tax_id (text)
- previous_funding_amount (numeric)
- previous_funding_source (text)
- is_updatable (boolean, default true)
- last_updated_at (timestamp)
- update_count (integer, default 0)

---

## ✅ Part 2: Storage Buckets Setup (REQUIRED)

### Step 1: Create Campaign Images Bucket
1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Bucket name: **campaign-images**
4. Make it **Public**
5. Click "Create bucket"

### Step 2: Set Storage Policies for campaign-images
Go to Storage → campaign-images → Policies and create:

**Policy 1: Allow Authenticated Users to Upload**
```sql
CREATE POLICY "Authenticated users can upload campaign images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-images' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);
```

**Policy 2: Allow Public Read**
```sql
CREATE POLICY "Public can view campaign images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'campaign-images');
```

**Policy 3: Allow Users to Delete Own Images**
```sql
CREATE POLICY "Users can delete own campaign images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'campaign-images' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);
```

### Step 3: Create Campaign Documents Bucket (Optional - for pitch decks, whitepapers)
1. Click "New bucket"
2. Bucket name: **campaign-documents**
3. Make it **Public**
4. Create same 3 policies as above (replace 'campaign-images' with 'campaign-documents')

---

## ✅ Part 3: Update Application Routes

### Update App.jsx
Replace the old CreateProject route with:

```javascript
import CreateProject from './pages/CreateProject_Enhanced.jsx';

// In routes:
<Route path="/create-project" element={<ProtectedRoute><CreateProject /></ProtectedRoute>} />
<Route path="/edit-campaign/:campaignId" element={<ProtectedRoute><CreateProject /></ProtectedRoute>} />
```

---

## ✅ Part 4: Update Dashboard to Show Edit Button

### In Dashboard.jsx
Add this code in the campaigns list section (around line 1100):

```javascript
// In the campaign card display section
{campaign.status === 'pending_review' && campaign.is_updatable && (
  <button
    onClick={() => navigate(`/edit-campaign/${campaign.id}`)}
    className="btn-edit-campaign"
    style={{
      background: '#667eea',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px'
    }}
  >
    ✏️ Edit Campaign
  </button>
)}

{campaign.update_count > 0 && (
  <span className="updated-badge" style={{
    background: '#fef3c7',
    color: '#92400e',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    marginLeft: '10px'
  }}>
    UPDATED ({campaign.update_count}x)
  </span>
)}
```

---

## ✅ Part 5: Enhanced Campaign Display Page

### Update Campaign.jsx to show new fields

Add these sections to the campaign detail page:

```javascript
// After campaign description
{campaign.campaign_image_url && (
  <div className="campaign-banner">
    <img src={campaign.campaign_image_url} alt={campaign.title} />
  </div>
)}

{campaign.video_pitch_url && (
  <div className="video-section">
    <h3>Video Pitch</h3>
    <a href={campaign.video_pitch_url} target="_blank" rel="noopener">
      Watch Video →
    </a>
  </div>
)}

<div className="campaign-section">
  <h3>📊 Market Analysis</h3>
  <p>{campaign.market_analysis}</p>
</div>

<div className="campaign-section">
  <h3>💡 Competitive Advantage</h3>
  <p>{campaign.competitive_advantage}</p>
</div>

<div className="campaign-section">
  <h3>🎯 Target Audience</h3>
  <p>{campaign.target_audience}</p>
</div>

<div className="campaign-section">
  <h3>💼 Business Model</h3>
  <p>{campaign.business_model}</p>
</div>

{campaign.use_of_funds && (
  <div className="campaign-section">
    <h3>💰 Use of Funds</h3>
    {campaign.use_of_funds.map((item, idx) => (
      <div key={idx} className="fund-item">
        <strong>{item.category}</strong> - {item.amount}%
        <p>{item.description}</p>
      </div>
    ))}
  </div>
)}

<div className="campaign-section">
  <h3>⚠️ Risks & Challenges</h3>
  <p>{campaign.risks_and_challenges}</p>
</div>

<div className="campaign-section">
  <h3>👥 Team ({campaign.team_size} members)</h3>
  <p>{campaign.team_experience}</p>
</div>

{campaign.social_media_links && (
  <div className="campaign-section">
    <h3>🔗 Connect</h3>
    <div className="social-links">
      {campaign.social_media_links.twitter && (
        <a href={campaign.social_media_links.twitter}>Twitter</a>
      )}
      {campaign.social_media_links.linkedin && (
        <a href={campaign.social_media_links.linkedin}>LinkedIn</a>
      )}
      {campaign.website_url && (
        <a href={campaign.website_url}>Website</a>
      )}
      {campaign.github_repository && (
        <a href={campaign.github_repository}>GitHub</a>
      )}
    </div>
  </div>
)}

{campaign.pitch_deck_url && (
  <div className="campaign-section">
    <h3>📄 Resources</h3>
    <a href={campaign.pitch_deck_url} target="_blank">View Pitch Deck</a>
  </div>
)}
```

---

## ✅ Part 6: Admin Panel Updates

### Show new fields in AdminPanel.jsx

Update campaign approval section to show:

```javascript
// In campaign review modal/section
<div className="admin-campaign-details">
  {campaign.update_count > 0 && (
    <div className="admin-notice" style={{
      background: '#fef3c7',
      padding: '15px',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      ⚠️ This campaign has been updated {campaign.update_count} time(s).
      Last updated: {new Date(campaign.last_updated_at).toLocaleString()}
    </div>
  )}

  <div className="field-group">
    <label>Team Size:</label>
    <span>{campaign.team_size} members</span>
  </div>

  <div className="field-group">
    <label>Project Stage:</label>
    <span>{campaign.project_stage}</span>
  </div>

  <div className="field-group">
    <label>Market Analysis:</label>
    <p>{campaign.market_analysis}</p>
  </div>

  <div className="field-group">
    <label>Use of Funds:</label>
    {campaign.use_of_funds && campaign.use_of_funds.map((item, idx) => (
      <div key={idx}>
        {item.category}: {item.amount}% - {item.description}
      </div>
    ))}
  </div>

  <div className="field-group">
    <label>Legal Structure:</label>
    <span>{campaign.legal_structure || 'Not provided'}</span>
  </div>

  {/* Add more fields as needed */}
</div>
```

---

## 🧪 Testing Checklist

### After Setup, Test:

1. **Image Upload**
   - [ ] Can upload campaign banner image
   - [ ] Image appears in preview
   - [ ] Can remove and re-upload image
   - [ ] Image persists after form navigation

2. **Form Validation**
   - [ ] Cannot proceed with empty required fields
   - [ ] Character limits enforced
   - [ ] Use of funds must total 100%
   - [ ] Milestones must total 100%
   - [ ] URLs validated correctly

3. **Campaign Creation**
   - [ ] All new fields save correctly
   - [ ] Milestones linked properly
   - [ ] Status set to 'pending_review'
   - [ ] is_updatable set to true

4. **Campaign Update**
   - [ ] Edit button appears for pending campaigns
   - [ ] Loads existing data correctly
   - [ ] Updates save successfully
   - [ ] update_count increments
   - [ ] last_updated_at updates

5. **Display**
   - [ ] Campaign page shows all new fields
   - [ ] Images display properly
   - [ ] Use of funds breakdown visible
   - [ ] Social links work correctly

6. **Admin View**
   - [ ] Admin sees all new fields
   - [ ] Updated badge appears
   - [ ] Update history visible
   - [ ] Approval process works

---

## 🚨 Troubleshooting

### Image Upload Fails
- Check bucket exists and is public
- Verify RLS policies are created
- Check browser console for storage errors
- Ensure user is authenticated

### Validation Errors
- Check browser console for specific errors
- Verify all required fields have values
- Check percentages total 100%

### Update Not Saving
- Verify campaign status is 'pending_review'
- Check is_updatable is true
- Verify RLS policy allows updates
- Check browser network tab for errors

### Fields Not Displaying
- Verify migration ran successfully
- Check database columns exist
- Refresh Supabase types/cache
- Check data exists in database

---

## 📝 Notes

- **KYC Required**: Users must complete KYC before creating campaigns
- **Update Window**: Creators can only update campaigns with status 'pending_review' and is_updatable=true
- **Admin Control**: Admins can disable updates by setting is_updatable=false
- **File Limits**: Images max 10MB, documents max 50MB (configurable in storage settings)

---

## 🎉 Success Indicators

When setup is complete, you should see:
✅ 25+ new columns in campaigns table
✅ Two new storage buckets with RLS policies
✅ 6-step creation wizard with image upload
✅ Edit button on pending campaigns
✅ Enhanced campaign details page
✅ Updated admin review panel

---

## Need Help?
- Check Supabase logs for database errors
- Review browser console for frontend errors
- Verify all environment variables are set
- Test with a fresh campaign creation

