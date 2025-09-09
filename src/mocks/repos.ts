import { GithubRepo } from '../clients/github.gql';

function toClickhouse(isoDate: string): string {
  return isoDate.slice(0, 19).replace('T', ' ');
}

function daysAgo(days: number): string {
  return new Date(new Date().getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const mockRepos: GithubRepo[] = [
  {
    nameWithOwner: 'rising/fast',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(5),
    stargazerCount: 1250,
    owner: {
      __typename: 'Organization',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'rising/fast',
      firstSeenAt: toClickhouse(daysAgo(5)),
      starsWithin: '1250',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'hidden/gem',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(90), // was under development for a while
    stargazerCount: 890,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'hidden/gem',
      firstSeenAt: toClickhouse(daysAgo(90)),
      starsWithin: '800',
      starsBefore: '90', // had some stars before the window
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'cutoff/edge',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(9), // just outside the default 7-day window
    stargazerCount: 1050,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'cutoff/edge',
      firstSeenAt: toClickhouse(daysAgo(9)),
      starsWithin: '1000',
      starsBefore: '50', // wasn't that popular in a week before
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'no/desc',
    url: 'https://github.com/owner/repo',
    description: null, // no description
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'no/desc',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'long/desc',
    url: 'https://github.com/owner/repo',
    description: 'abc '.repeat(100), // long description
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'no/desc',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'no/lang',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: null, // no primary language
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'no/lang',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'bad/malware',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: daysAgo(3), // fresh owner with fake stars
    },
    clickhouse: {
      repoName: 'bad/malware',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'blocklist/kms', // "kms" is a blocklisted keyword
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z', // passes fresh owner check
    },
    clickhouse: {
      repoName: 'bad/malware',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'blocklist/AimBot', // "aimbot" is a blocklisted keyword
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z', // passes fresh owner check
    },
    clickhouse: {
      repoName: 'bad/malware',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'ox1nec/blocklisted', // "ox1nec" user is blocklisted
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z', // passes fresh owner check
    },
    clickhouse: {
      repoName: 'bad/malware',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'new/org',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'Organization',
      createdAt: daysAgo(3), // fresh org, but it's ok
    },
    clickhouse: {
      repoName: 'new/org',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'chinese/repo',
    url: 'https://github.com/owner/repo',
    description: '这是一个杰作，如果你是中国人的话，你就能欣赏它。', // Chinese description
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'chinese/repo',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'chinese/mixed',
    url: 'https://github.com/owner/repo',
    description: '带有一些English文本的中文描述', // Chinese description with English words
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 500,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'chinese/repo',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '500',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'low/stars',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(1),
    stargazerCount: 3, // below the default 50-star threshold
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'low/stars',
      firstSeenAt: toClickhouse(daysAgo(1)),
      starsWithin: '3',
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
  {
    nameWithOwner: 'renamed/repo',
    url: 'https://github.com/owner/repo',
    description: '[description]',
    primaryLanguage: { name: '[lang]' },
    createdAt: daysAgo(180),
    stargazerCount: 3000, // was very popular for a while
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
    clickhouse: {
      repoName: 'renamed/repo',
      firstSeenAt: toClickhouse(daysAgo(3)),
      starsWithin: '300', // inconsistent stars between CH and GH
      starsBefore: '0',
    },
    stargazers: {
      nodes: [{ createdAt: daysAgo(1000) }],
    },
  },
];
