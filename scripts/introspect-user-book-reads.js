// introspection script to discover user_book_reads input fields
// run with: node scripts/introspect-user-book-reads.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const token = envContent.split('=')[1].trim();

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      types {
        name
        kind
        description
        inputFields {
          name
          description
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  }
`;

async function introspect() {
  try {
    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: introspectionQuery
      })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('graphql errors:', JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    const types = data.data.__schema.types || [];

    // find DatesReadInput type (used by insert_user_book_read and update_user_book_read)
    const datesReadInput = types.find(t => t.name === 'DatesReadInput');

    console.log('\n-- DatesReadInput fields --\n');
    if (datesReadInput && datesReadInput.inputFields) {
      datesReadInput.inputFields.forEach(field => {
        const typeName = field.type.ofType?.name || field.type.name;
        const required = field.type.kind === 'NON_NULL' ? ' (required)' : '';
        console.log(`${field.name}: ${typeName}${required}`);
        if (field.description) {
          console.log(`  ${field.description}`);
        }
      });
    } else {
      console.log('not found');
    }

    console.log('\n\nfrom mutations list, we have:');
    console.log('- insert_user_book_read(user_book_id: Int, user_book_read: DatesReadInput)');
    console.log('- update_user_book_read(id: Int, object: DatesReadInput)');
    console.log('- upsert_user_book_reads(datesRead: [DatesReadInput], user_book_id: Int)');

  } catch (error) {
    console.error('failed to introspect api:', error);
    process.exit(1);
  }
}

introspect();
