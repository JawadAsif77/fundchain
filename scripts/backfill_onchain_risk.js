import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing env vars. Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseArgs(argv) {
  const args = {
    limit: 200,
    dryRun: false,
    includeNotAnalyzed: false,
    retryNoWallet: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--include-not-analyzed') args.includeNotAnalyzed = true;
    if (arg === '--retry-no-wallet') args.retryNoWallet = true;
    if (arg === '--limit' && argv[i + 1]) {
      args.limit = Number(argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

async function fetchTargetCampaigns(limit, includeNotAnalyzed, retryNoWallet) {
  if (retryNoWallet) {
    let query = supabase
      .from('campaigns')
      .select('id, title, analyzed_at, onchain_risk_details')
      .not('onchain_risk_details', 'is', null)
      .order('created_at', { ascending: true })
      .limit(Math.max(limit * 3, 300));

    if (!includeNotAnalyzed) {
      query = query.not('analyzed_at', 'is', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    const campaigns = (data || []).filter((row) => {
      const explanation = row?.onchain_risk_details?.explanation || '';
      return typeof explanation === 'string' && explanation.toLowerCase().includes('no wallet address provided');
    });

    return campaigns.slice(0, limit);
  }

  let query = supabase
    .from('campaigns')
    .select('id, title, analyzed_at, onchain_risk_details')
    .is('onchain_risk_details', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!includeNotAnalyzed) {
    query = query.not('analyzed_at', 'is', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function run() {
  const { limit, dryRun, includeNotAnalyzed, retryNoWallet } = parseArgs(process.argv);

  console.log('🚀 Backfill On-Chain Risk Details');
  console.log('==================================');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
  console.log(`Include not analyzed campaigns: ${includeNotAnalyzed ? 'yes' : 'no'}`);
  console.log(`Retry campaigns with missing wallet fallback: ${retryNoWallet ? 'yes' : 'no'}`);

  const campaigns = await fetchTargetCampaigns(limit, includeNotAnalyzed, retryNoWallet);

  if (campaigns.length === 0) {
    console.log('✅ Nothing to backfill.');
    return;
  }

  console.log(`\nFound ${campaigns.length} campaign(s) to backfill.`);

  if (dryRun) {
    campaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.id} - ${campaign.title || 'Untitled campaign'}`);
    });
    console.log('\n🧪 Dry run complete. No changes made.');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < campaigns.length; i++) {
    const campaign = campaigns[i];
    const label = `${i + 1}/${campaigns.length}`;

    process.stdout.write(`\n[${label}] Processing ${campaign.id} ... `);

    try {
      const { error } = await supabase.functions.invoke('analyze_project', {
        body: { campaign_id: campaign.id },
      });

      if (error) {
        failCount += 1;
        console.log(`❌ ${error.message}`);
      } else {
        successCount += 1;
        console.log('✅ done');
      }
    } catch (err) {
      failCount += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${message}`);
    }
  }

  console.log('\n\n📊 Backfill Summary');
  console.log('===================');
  console.log(`Success: ${successCount}`);
  console.log(`Failed:  ${failCount}`);
  console.log(`Total:   ${campaigns.length}`);
}

run().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ Backfill failed: ${message}`);
  process.exit(1);
});
