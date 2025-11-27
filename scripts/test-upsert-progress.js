// test upserting progress with the existing record id
// run with: node scripts/test-upsert-progress.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const token = envContent.split('=')[1].trim();

const userBookId = 10351088;
const existingReadId = 3724494;
const newPage = 35;

const mutation = `
  mutation UpdateProgress($userBookId: Int!, $page: Int!, $readId: Int!) {
    upsert_user_book_reads(
      user_book_id: $userBookId,
      datesRead: [{
        id: $readId,
        progress_pages: $page
      }]
    ) {
      user_book_id
      error
    }
  }
`;

async function testUpsert() {
  try {
    console.log('attempting to update progress to page:', newPage);
    console.log('user_book_id:', userBookId);
    console.log('existing read id:', existingReadId);

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          userBookId: userBookId,
          page: newPage,
          readId: existingReadId
        }
      })
    });

    const data = await response.json();

    console.log('\nfull response:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('failed:', error);
  }
}

testUpsert();
