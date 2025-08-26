#!/usr/bin/env node

import 'dotenv-flow/config';
import { scan } from './pipeline/scan';
import { rank } from './pipeline/rank';
import { publishAll } from './pipeline/publish';
import { logInfo } from './utils/logging';
import { handleProcessError } from './utils/common';

export async function run(): Promise<void> {
  await main().catch(handleProcessError);
}

export async function main(): Promise<void> {
  const window = parseInt(process.env.FETCH_WINDOW_DAYS || '7');
  const limit = parseInt(process.env.SCAN_LIMIT || '10');

  console.log(`📡 Scanning the GitHub universe (window: ${window}, limit: ${limit})`);
  const repos = await scan();
  logInfo('scan', `${repos.length} trending repos discovered`);
  console.log('');

  console.log('🏆 Scoring to select the best');
  const scoredRepos = rank(repos);
  logInfo('score', `${scoredRepos.length} repos selected`);
  console.log('');

  console.log('📮 Publishing to all enabled channels');
  const messageIds = await publishAll(scoredRepos);
  logInfo('publish', `published release (IDs: ${messageIds.join(', ')})`);
}

// Run if this is the main module
if (require.main === module) {
  void run();
}
