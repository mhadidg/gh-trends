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

  return await github.getRepos(repos);
}
