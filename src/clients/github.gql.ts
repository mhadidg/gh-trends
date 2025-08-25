import { HttpError, logWarn, TaggedError } from '../utils/logging';

export type GithubRepo = {
  nameWithOwner: string;
  url: string;
  description: string | null;
  createdAt: string; // repo createdAt
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
  owner: {
    __typename: 'User' | 'Organization';
    createdAt: string; // owner createdAt
  };
};

export type GitHubErrorItem = {
  type: string;
  message: string;
};

export class GitHubGraphQLClient {
  public static readonly endpoint = 'https://api.github.com/graphql';
  private readonly token: string;

  constructor(token?: string) {
    if (!token) throw new TaggedError('config', 'GITHUB_TOKEN required');
    this.token = token;
  }

  async getRepos(fullNames: string[]): Promise<GithubRepo[]> {
    if (fullNames.length === 0) return [];

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
      }
    `;

    const parts = fullNames.map((full, i) => {
      const [owner, name] = full.split('/');
      if (!owner || !name) throw new TaggedError('github', `Invalid repo: ${full}`);
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

    if (!response.ok) {
      throw new HttpError('github', 'fetching repos with GraphQL failed', response);
    }

    const json = await response.json();
    if (json.errors?.length) {
      // Repo deleted or made private (was public before)
      const types = new Set(json.errors.map((e: GitHubErrorItem) => e.type));
      if (types.size === 1 && types.has('NOT_FOUND')) {
        json.errors.forEach((e: GitHubErrorItem) => logWarn('github', e.message));
      } else {
        throw new TaggedError('github', `GraphQL errors: ${JSON.stringify(json.errors)}`);
      }
    }

    const data = json.data || {};
    const nodes: GithubRepo[] = [];
    for (let i = 0; i < fullNames.length; i++) {
      const node = data[`r${i}`];
      if (node) nodes.push(node);
    }

    return nodes;
  }
}
