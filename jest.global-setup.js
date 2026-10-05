const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

module.exports = async () => {
  if (!process.env.TEST_DB) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
  }

  if (process.env.TEST_DB !== '1') {
    throw new Error(
      'ABORTING: TEST_DB environment variable is not set to "1". Refusing to run integration tests or migrations.'
    );
  }

  console.log('\n[jest.global-setup] Running prisma migrate deploy on test database...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
};
