import { HttpError, logInfo, TaggedError } from '../utils/logging';
import { ClickHouseRepo } from './clickhouse';

export type GithubRepo = {
  nameWithOwner: string;
  url: string;
  description: string | null;
  createdAt: string; // repo createdAt
  clickhouse: ClickHouseRepo; // not part of GraphQL response
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
  owner: {
    __typename: 'User' | 'Organization';
    createdAt: string; // owner createdAt
  };
  stargazers: {
    nodes: {
      createdAt: string; // stargazer createdAt
    }[];
  };
};

export type GitHubErrorItem = {
  type: string;
  message: string;
};

// Externally defined to override in tests
export const config = {
  batchSize: 20, // max repos per request
  waitInMillis: 30_000, // wait time on rate limit
  maxRetries: 3, // max retries on rate limit
};

export class GitHubGraphQLClient {
  public static readonly endpoint = 'https://api.github.com/graphql';
  private readonly token: string;

  constructor(token?: string) {
    if (!token) throw new TaggedError('config', 'GITHUB_TOKEN required');
    this.token = token;
  }

  async getRepos(repos: ClickHouseRepo[]): Promise<GithubRepo[]> {
    if (repos.length === 0) return [];

    const all: GithubRepo[] = [];

    // Build aliases: r0, r1, ...
    const fields = (owner: string, name: string, i: number) => `
      r${i}: repository(owner: "${owner}", name: "${name}") {
        nameWithOwner
        url
        description
        createdAt
        stargazerCount
        primaryLanguage { name }
        owner {
          __typename
          ... on User { createdAt }
          ... on Organization { createdAt }
        }
        stargazers(first: 50, orderBy: { field: STARRED_AT, direction: DESC }) {
          nodes {
            createdAt
          }
        }
      }
    `;

    let attempt = 0;
    for (let start = 0; start < repos.length; ) {
      const batch = repos.slice(start, start + config.batchSize);

      const parts = batch.map((repo, i) => {
        const [owner, name] = repo.repoName.split('/');
        if (!owner || !name) throw new TaggedError('github', `invalid repo: ${repo.repoName}`);
        return fields(owner, name, i);
      });

      const query = `query BatchedRepos { ${parts.join('\n')} }`;

      const response = await fetch(GitHubGraphQLClient.endpoint, {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
      });

      if (response.status === 403) {
        const json = await response.json();
        if (json.message?.includes('secondary rate limit')) {
          attempt += 1;
          if (attempt > config.maxRetries) {
            throw new TaggedError('github', 'secondary rate limit hit, too many retries');
          }

          logInfo('github', 'secondary rate limit hit, waiting a bit to retry...');
          await new Promise(resolve => setTimeout(resolve, config.waitInMillis));
          continue;
        }
      }

      if (!response.ok) {
        // Safe access to skip the headers part in testing mocks
        const limit = response.headers?.get('X-RateLimit-Limit');
        const remaining = response.headers?.get('X-RateLimit-Remaining');
        if (limit && remaining) {
          logInfo('github', `rate limit: ${remaining}/${limit} requests remaining`);
        }

        throw new HttpError('github', 'fetching repos with GraphQL failed', response);
      }

      const json = await response.json();
      if (json.errors?.length) {
        // Repo deleted or made private (was public before)
        const types = new Set(json.errors.map((e: GitHubErrorItem) => e.type));
        if (!(types.size === 1 && types.has('NOT_FOUND'))) {
          throw new TaggedError('github', `GraphQL errors: ${JSON.stringify(json.errors)}`);
        }
      }

      const data = json.data || {};
      for (let i = 0; i < batch.length; i++) {
        const node = data[`r${i}`];
        if (node) all.push({ ...node, clickhouse: batch[i] });
      }

      start += config.batchSize;
      logInfo('github', `fetched ${start}/${repos.length} repos so far`);
    }

    return all;
  }
}
