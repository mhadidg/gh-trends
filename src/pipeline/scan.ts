import { logInfo } from '../utils/logging';
import { ClickHouseClient } from '../clients/clickhouse';
import { GitHubGraphQLClient, GithubRepo } from '../clients/github.gql';
import { mockRepos } from '../mocks/repos';

export async function scan(): Promise<GithubRepo[]> {
  if (process.env.USE_MOCK_REPOS !== 'false') {
    logInfo('scan', 'using mock repos');
    return mockRepos;
  }

  // Create object early to validate env vars
  const clickhouse = new ClickHouseClient();
  const github = new GitHubGraphQLClient(process.env.GITHUB_TOKEN);

  const dayAgo = parseInt(process.env.SCAN_WINDOW_DAYS || '7');
  const limit = parseInt(process.env.SCAN_LIMIT || '100');

  const repos = await clickhouse.getTrendingRepos(dayAgo, limit);
  logInfo('clickhouse', `fetched ${repos.length} repos`);

  const enrichedRepos = await github.getRepos(repos);
  const missing = repos.length - enrichedRepos.length;
  if (missing > 0) {
    logInfo('github', `out of ${repos.length} repos, ${missing} are no longer exist`);
  }

  return enrichedRepos;
}
