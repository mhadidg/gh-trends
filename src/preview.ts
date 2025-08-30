#!/usr/bin/env node

import 'dotenv-flow/config';
import { scan } from './pipeline/scan';
import { rank } from './pipeline/rank';
import { render } from './pipeline/render';
import { logError, logInfo, TaggedError } from './utils/logging';
import { handleProcessError } from './utils/common';

async function preview() {
  const window = parseInt(process.env.SCAN_WINDOW_DAYS!);
  const limit = parseInt(process.env.SCAN_LIMIT!);

  console.log(`📡 Scanning the GitHub universe (window: ${window}, limit: ${limit})`);
  const repos = await scan();
  logInfo('scan', `${repos.length} trending repos discovered`);
  console.log('');

  console.log('🏆 Scoring to select the best');
  const scoredRepos = rank(repos);
  logInfo('score', `${scoredRepos.length} repos selected`);
  console.log('');

  console.log('✍️ Crafting release content');

  const templateName = process.env.TEMPLATE_NAME;
  if (!templateName) {
    const error = new TaggedError('render', 'TEMPLATE_NAME is not set');
    logError(error.tag, error);
    process.exit(1);
  }

  const content = render(templateName, scoredRepos);
  logInfo('render', `rendered release`);

  console.log('');
  console.log('─'.repeat(50));
  console.log(content);
}

// Run if this is the main module
if (require.main === module) {
  preview().catch(handleProcessError);
}
