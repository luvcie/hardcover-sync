// query actual reading journals to see what event types are used
// run with: node scripts/query-journal-examples.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const token = envContent.split('=')[1].trim();

const query = `
  query GetReadingJournals {
    reading_journals(limit: 20, order_by: {created_at: desc}) {
      id
      event
      metadata
      entry
      book {
        title
      }
    }
  }
`;

async function queryJournals() {
  try {
    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: query
      })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('graphql errors:', JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    const journals = data.data?.reading_journals || [];

    console.log('\n-- recent reading journal entries --\n');
    console.log(`found ${journals.length} entries\n`);

    // collect unique event types
    const eventTypes = new Set();

    journals.forEach((journal, index) => {
      eventTypes.add(journal.event);

      console.log(`${index + 1}. ${journal.book?.title || 'unknown book'}`);
      console.log(`   event: ${journal.event}`);
      if (journal.metadata) {
        console.log(`   metadata: ${JSON.stringify(journal.metadata)}`);
      }
      if (journal.entry) {
        console.log(`   entry: ${journal.entry.substring(0, 100)}${journal.entry.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });

    console.log('\n-- unique event types found --\n');
    Array.from(eventTypes).sort().forEach(event => {
      console.log(`  - ${event}`);
    });

  } catch (error) {
    console.error('failed to query journals:', error);
    process.exit(1);
  }
}

queryJournals();
