#!/usr/bin/env node

import 'dotenv-flow/config';
import { scan } from './pipeline/scan';
import { select } from './pipeline/select';
import { publishAll } from './pipeline/publish';
import { logInfo, TaggedError } from './utils/logging';
import { handleProcessError } from './utils/common';
import { filter } from './pipeline/filter';

export async function run(): Promise<void> {
  await main().catch(handleProcessError);
}

export async function main(): Promise<void> {
  const window = parseInt(process.env.SCAN_WINDOW_DAYS!);
  const limit = parseInt(process.env.SCAN_LIMIT!);

  console.log(`📡 Scanning the GitHub universe (window: ${window}, limit: ${limit})`);
  const trendingRepos = await scan();
  logInfo('scan', `${trendingRepos.length} trending repos discovered`);

  if (trendingRepos.length === 0) {
    throw new TaggedError(`scan`, 'no repos found; aborting');
  }

  console.log('\n', `🧐 Inspecting to filter out bad stuff`);
  const filteredRepos = filter(trendingRepos);
  logInfo(`filter`, `${filteredRepos.length} repos remain after filtering`);

  if (trendingRepos.length / filteredRepos.length > 2) {
    throw new TaggedError(`filter`, 'too many repos filtered out; aborting');
  }

  console.log('\n', '🏆 Ranking to select the best');
  const scoredRepos = select(filteredRepos);
  logInfo('score', `${scoredRepos.length} repos selected`);

  console.log('\n', '📮 Publishing to all enabled channels');
  const messageIds = await publishAll(scoredRepos);
  logInfo('publish', `published release (IDs: ${messageIds.join(', ')})`);
}

// Run if this is the main module
if (require.main === module) {
  void run();
}
