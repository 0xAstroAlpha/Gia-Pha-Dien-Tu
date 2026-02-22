/**
 * Sync mock-genealogy.ts data to Supabase
 * Step 1: Uses npx tsx to export mock data to JSON
 * Step 2: Reads JSON and upserts to Supabase via REST API
 * 
 * Run: node sync-to-supabase.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read env
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)="?([^"]*)"?$/);
    if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

console.log(`Supabase URL: ${SUPABASE_URL}`);

async function upsertToSupabase(table, rows, batchSize = 200) {
    console.log(`Upserting ${rows.length} rows to ${table}...`);

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify(batch),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`  ❌ Batch ${Math.floor(i / batchSize) + 1} failed: ${response.status} ${errText}`);
        } else {
            console.log(`  ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows upserted`);
        }
    }
}

async function deleteAll(table) {
    // Delete all rows using a filter that matches everything
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?handle=neq.______impossible______`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
    });
    return response.status;
}

async function main() {
    // Step 1: Export mock data to JSON using the existing script
    console.log('Step 1: Exporting mock data to JSON...');
    try {
        execSync('npx tsx supabase/export-mock-data.ts', {
            cwd: __dirname,
            stdio: 'inherit'
        });
    } catch (e) {
        console.error('Failed to export:', e.message);
        process.exit(1);
    }

    // Step 2: Read the exported JSON
    const jsonPath = path.resolve(__dirname, 'supabase/mock-data-export.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    console.log(`\nLoaded ${jsonData.people.length} people, ${jsonData.families.length} families from JSON`);

    // Step 3: Delete existing data (families first due to potential FK)
    console.log('\nStep 2: Clearing existing Supabase data...');
    const delFamStatus = await deleteAll('families');
    console.log(`  Families delete: ${delFamStatus}`);
    const delPeopleStatus = await deleteAll('people');
    console.log(`  People delete: ${delPeopleStatus}`);

    // Step 4: Insert all data
    console.log('\nStep 3: Inserting data to Supabase...');
    await upsertToSupabase('people', jsonData.people);
    await upsertToSupabase('families', jsonData.families);

    // Step 5: Verify counts
    console.log('\nStep 4: Verifying...');
    const pCount = await fetch(`${SUPABASE_URL}/rest/v1/people?select=handle`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' }
    });
    const fCount = await fetch(`${SUPABASE_URL}/rest/v1/families?select=handle`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' }
    });

    const pTotal = pCount.headers.get('content-range');
    const fTotal = fCount.headers.get('content-range');
    console.log(`  People in Supabase: ${pTotal}`);
    console.log(`  Families in Supabase: ${fTotal}`);

    console.log('\n✅ Sync complete!');
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
