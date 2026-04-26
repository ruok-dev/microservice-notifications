'use strict';

/**
 * One-time script to create an initial admin API key.
 * Run: node scripts/generateApiKey.js
 */
require('dotenv').config();
const ApiKey = require('../src/models/apiKey');
const { close } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function main() {
  try {
    const result = await ApiKey.create({
      name: 'Initial Admin Key',
      scopes: [ApiKey.SCOPES.ADMIN, ApiKey.SCOPES.NOTIFICATIONS_WRITE, ApiKey.SCOPES.NOTIFICATIONS_READ],
    });

    console.log('\n✅  API Key created successfully');
    console.log('─────────────────────────────────────────');
    console.log(`  ID     : ${result.id}`);
    console.log(`  Name   : ${result.name}`);
    console.log(`  Prefix : ${result.prefix}`);
    console.log(`  Scopes : ${result.scopes.join(', ')}`);
    console.log(`\n  🔑 API Key: ${result.rawKey}`);
    console.log('\n  ⚠️  Save this key now. It will NOT be shown again.');
    console.log('─────────────────────────────────────────\n');
  } catch (err) {
    logger.error({ err }, 'Failed to create API key');
    process.exit(1);
  } finally {
    await close();
  }
}

main();
