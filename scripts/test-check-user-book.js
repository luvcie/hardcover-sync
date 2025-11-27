// test the check user book query
// run with: node scripts/test-check-user-book.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const token = envContent.split('=')[1].trim();

const bookId = 484962;

const checkQuery = `
  query CheckUserBook($bookId: Int!) {
    user_books(where: {book_id: {_eq: $bookId}}) {
      id
      status_id
      book_id
    }
  }
`;

async function testCheck() {
  try {
    console.log('testing query with book_id:', bookId);

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: checkQuery,
        variables: { bookId: bookId }
      })
    });

    const data = await response.json();

    console.log('\nfull response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error('\nerrors:', data.errors);
      return;
    }

    const userBooks = data.data?.user_books || [];
    console.log(`\nfound ${userBooks.length} books`);

    if (userBooks.length > 0) {
      console.log('books:', userBooks);
    }

  } catch (error) {
    console.error('failed:', error);
  }
}

testCheck();
