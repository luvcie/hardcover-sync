// query user_books to see what fields are available for tracking progress
// run with: node scripts/query-user-books.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const token = envContent.split('=')[1].trim();

const query = `
  query GetUserBooks {
    user_books(limit: 5, where: {status_id: {_eq: 2}}) {
      id
      book_id
      status_id
      book {
        title
        pages
      }
    }
  }
`;

async function queryUserBooks() {
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

    const userBooks = data.data?.user_books || [];

    console.log('\n-- your currently reading books --\n');
    console.log(`found ${userBooks.length} books\n`);

    userBooks.forEach((ub, index) => {
      console.log(`${index + 1}. ${ub.book?.title || 'unknown'}`);
      console.log(`   user_book_id: ${ub.id}`);
      console.log(`   book_id: ${ub.book_id}`);
      console.log(`   status_id: ${ub.status_id} (2 = currently reading)`);
      console.log(`   total pages: ${ub.book?.pages || 'unknown'}`);
      console.log('');
    });

    console.log('\nnote: user_books table doesn\'t seem to have a current_page field.');
    console.log('hardcover likely uses reading_journals with custom events for page tracking.\n');

  } catch (error) {
    console.error('failed to query user books:', error);
    process.exit(1);
  }
}

queryUserBooks();
