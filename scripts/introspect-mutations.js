// introspection script to discover hardcover api mutations
// run with: node scripts/introspect-mutations.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const token = envContent.split('=')[1].trim();

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      mutationType {
        name
        fields {
          name
          description
          args {
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

    const mutations = data.data.__schema.mutationType?.fields || [];

    console.log('\n-- all available mutations --\n');
    mutations.forEach(mutation => {
      console.log(`\n${mutation.name}`);
      if (mutation.description) {
        console.log(`  description: ${mutation.description}`);
      }
      if (mutation.args && mutation.args.length > 0) {
        console.log('  arguments:');
        mutation.args.forEach(arg => {
          const typeName = arg.type.ofType?.name || arg.type.name;
          console.log(`    - ${arg.name}: ${typeName}`);
          if (arg.description) {
            console.log(`      ${arg.description}`);
          }
        });
      }
    });

    console.log('\n\n-- progress/reading related mutations --\n');
    const progressMutations = mutations.filter(m =>
      m.name.toLowerCase().includes('progress') ||
      m.name.toLowerCase().includes('page') ||
      m.name.toLowerCase().includes('read') ||
      m.name.toLowerCase().includes('book') ||
      m.name.toLowerCase().includes('status')
    );

    if (progressMutations.length === 0) {
      console.log('no progress-related mutations found');
    } else {
      progressMutations.forEach(mutation => {
        console.log(`\n${mutation.name}`);
        if (mutation.description) {
          console.log(`  description: ${mutation.description}`);
        }
        if (mutation.args && mutation.args.length > 0) {
          console.log('  arguments:');
          mutation.args.forEach(arg => {
            const typeName = arg.type.ofType?.name || arg.type.name;
            const required = arg.type.kind === 'NON_NULL' ? ' (required)' : '';
            console.log(`    - ${arg.name}: ${typeName}${required}`);
            if (arg.description) {
              console.log(`      ${arg.description}`);
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
