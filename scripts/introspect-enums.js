// introspection script to discover enum types and values
// run with: node scripts/introspect-enums.js

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

    // find all enum types
    const enums = types.filter(t => t.kind === 'ENUM' && t.enumValues && t.enumValues.length > 0);

    console.log('\n-- all enum types --\n');
    enums.forEach(enumType => {
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

    console.log('\n\n-- reading journal related enums --\n');
    const journalEnums = enums.filter(e =>
      e.name.toLowerCase().includes('reading') ||
      e.name.toLowerCase().includes('journal') ||
      e.name.toLowerCase().includes('event') ||
      e.name.toLowerCase().includes('status')
    );

    if (journalEnums.length === 0) {
      console.log('no reading journal related enums found');
    } else {
      journalEnums.forEach(enumType => {
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
