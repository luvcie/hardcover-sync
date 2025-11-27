// introspection script to discover UserBooksReadUpsertType fields
// run with: node scripts/introspect-upsert-return.js

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
        fields {
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

    // find UserBooksReadUpsertType
    const upsertType = types.find(t => t.name === 'UserBooksReadUpsertType');

    console.log('\n-- UserBooksReadUpsertType fields --\n');
    if (upsertType && upsertType.fields) {
      upsertType.fields.forEach(field => {
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
