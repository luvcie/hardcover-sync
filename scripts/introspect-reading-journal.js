// introspection script to discover reading journal fields
// run with: node scripts/introspect-reading-journal.js

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

    // find reading journal types
    const readingJournalCreate = types.find(t => t.name === 'ReadingJournalCreateType');
    const readingJournalUpdate = types.find(t => t.name === 'ReadingJournalUpdateType');

    console.log('\n-- ReadingJournalCreateType fields --\n');
    if (readingJournalCreate && readingJournalCreate.inputFields) {
      readingJournalCreate.inputFields.forEach(field => {
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

    console.log('\n\n-- ReadingJournalUpdateType fields --\n');
    if (readingJournalUpdate && readingJournalUpdate.inputFields) {
      readingJournalUpdate.inputFields.forEach(field => {
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

  } catch (error) {
    console.error('failed to introspect api:', error);
    process.exit(1);
  }
}

introspect();
