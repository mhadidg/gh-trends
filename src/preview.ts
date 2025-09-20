#!/usr/bin/env node

import 'dotenv-flow/config';
import { scan } from './pipeline/scan';
import { select } from './pipeline/select';
import { render } from './pipeline/render';
import { logInfo } from './utils/logging';
import { handleProcessError } from './utils/common';
import { filter } from './pipeline/filter';

async function preview() {
  const window = parseInt(process.env.SCAN_WINDOW_DAYS!);
  const limit = parseInt(process.env.SCAN_LIMIT!);

  console.log(`📡 Scanning the GitHub universe (window: ${window}, limit: ${limit})`);
  const repos = await scan();
  logInfo('scan', `${repos.length} trending repos discovered`);

  console.log('\n', `🧐 Inspecting to filter out bad stuff`);
  const filteredRepos = filter(repos);
  logInfo(`filter`, `${filteredRepos.length} repos remain after filtering`);

  console.log('\n', '🏆 Ranking to select the best');
  const scoredRepos = select(filteredRepos);
  logInfo('select', `${scoredRepos.length} repos selected`);

  console.log('\n', '✍️ Crafting release content');
  const templateName = process.env.TEMPLATE_NAME || 'text.hbs';
  const content = render(templateName, scoredRepos);
  logInfo('render', `rendered release`);

  console.log('\n', '─'.repeat(50));
  console.log(content);
}

// Run if this is the main module
if (require.main === module) {
  preview().catch(handleProcessError);
}
