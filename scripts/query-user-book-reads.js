// query user_book_reads to see what progress data exists
// run with: node scripts/query-user-book-reads.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const token = envContent.split('=')[1].trim();

const userBookId = 10351088;

const query = `
  query GetUserBookReads($userBookId: Int!) {
    user_book_reads(
      where: {user_book_id: {_eq: $userBookId}},
      order_by: {id: desc},
      limit: 10
    ) {
      id
      user_book_id
      progress_pages
      progress_seconds
      started_at
      finished_at
    }
  }
`;

async function queryReads() {
  try {
    console.log('querying user_book_reads for user_book_id:', userBookId);

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: query,
        variables: { userBookId: userBookId }
      })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('\nerrors:', JSON.stringify(data.errors, null, 2));
      return;
    }

    console.log('\nfull response:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('failed:', error);
  }
}

queryReads();
