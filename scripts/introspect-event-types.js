// introspection script to discover event and status enum values
// run with: node scripts/introspect-event-types.js

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
        enumValues {
          name
          description
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

    // find all enum types, excluding select_column and constraint enums
    const enums = types.filter(t =>
      t.kind === 'ENUM' &&
      t.enumValues &&
      t.enumValues.length > 0 &&
      !t.name.includes('select_column') &&
      !t.name.includes('constraint') &&
      !t.name.includes('update_column') &&
      !t.name.includes('order_by')
    );

    console.log('\n-- useful enums (filtered) --\n');

    // show enums that might be relevant
    const relevantEnums = enums.filter(e =>
      e.name.toLowerCase().includes('event') ||
      e.name.toLowerCase().includes('status') ||
      e.name.toLowerCase().includes('journal') ||
      e.name.toLowerCase().includes('book') ||
      e.name.toLowerCase().includes('reading')
    );

    if (relevantEnums.length === 0) {
      console.log('no relevant enums found');
      console.log('\nshowing first 10 enums to help debug:\n');
      enums.slice(0, 10).forEach(enumType => {
        console.log(`\n${enumType.name}`);
        if (enumType.enumValues && enumType.enumValues.length <= 20) {
          console.log('  values:');
          enumType.enumValues.forEach(value => {
            console.log(`    - ${value.name}`);
          });
        } else {
          console.log(`  (${enumType.enumValues.length} values)`);
        }
      });
    } else {
      relevantEnums.forEach(enumType => {
        console.log(`\n${enumType.name}`);
        if (enumType.description) {
          console.log(`  description: ${enumType.description}`);
        }
        if (enumType.enumValues) {
          console.log('  values:');
          enumType.enumValues.forEach(value => {
            console.log(`    - ${value.name}`);
            if (value.description) {
              console.log(`      ${value.description}`);
            }
          });
        }
      });
    }

  } catch (error) {
    console.error('failed to introspect api:', error);
    process.exit(1);
  }
}

introspect();
