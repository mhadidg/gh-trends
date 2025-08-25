import { GithubRepo } from '../clients/github.gql';

export const mockRepos: GithubRepo[] = [
  {
    nameWithOwner: 'example/awesome-project',
    url: 'https://github.com/example/awesome-project',
    description: 'An awesome new project that does amazing things',
    primaryLanguage: {
      name: 'TypeScript',
    },
    createdAt: '2024-12-15T10:30:00Z',
    stargazerCount: 1250,
    owner: {
      __typename: 'Organization',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'dev/cool-tool',
    url: 'https://github.com/dev/cool-tool',
    description: 'A cool CLI tool for developers',
    primaryLanguage: {
      name: 'Go',
    },
    createdAt: '2024-12-14T15:45:00Z',
    stargazerCount: 890,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'startup/ml-framework',
    url: 'https://github.com/startup/ml-framework',
    description: 'Next-gen machine learning framework',
    primaryLanguage: {
      name: 'Python',
    },
    createdAt: '2024-12-13T08:20:00Z',
    stargazerCount: 2100,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'team/web-component',
    url: 'https://github.com/team/web-component',
    description: 'Reusable web components library',
    primaryLanguage: {
      name: 'JavaScript',
    },
    createdAt: '2024-12-12T12:00:00Z',
    stargazerCount: 675,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'org/data-viz',
    url: 'https://github.com/org/data-viz',
    description: 'Beautiful data visualization library',
    primaryLanguage: {
      name: 'JavaScript',
    },
    createdAt: '2024-12-11T16:30:00Z',
    stargazerCount: 1450,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'scam/repo',
    url: 'https://github.com/devs/api-client',
    description: 'Owner created just today; 99% fake stars',
    primaryLanguage: {
      name: 'TypeScript',
    },
    createdAt: '2024-12-10T09:15:00Z',
    stargazerCount: 720,
    owner: {
      __typename: 'User',
      createdAt: new Date().toISOString(),
    },
  },
  {
    nameWithOwner: 'company/mobile-app',
    url: 'https://github.com/company/mobile-app',
    description: 'Cross-platform mobile development kit',
    primaryLanguage: {
      name: 'Dart',
    },
    createdAt: '2024-12-09T14:45:00Z',
    stargazerCount: 980,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'community/game-engine',
    url: 'https://github.com/community/game-engine',
    description: 'Lightweight 2D game engine',
    primaryLanguage: {
      name: 'C++',
    },
    createdAt: '2024-12-08T11:20:00Z',
    stargazerCount: 1800,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'makers/design-system',
    url: 'https://github.com/makers/design-system',
    description:
      'Example of very long description that might need to be truncated in certain displays or ' +
      'contexts to ensure that the layout remains clean and user-friendly',
    primaryLanguage: null,
    createdAt: '2024-12-07T13:10:00Z',
    stargazerCount: 540,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    nameWithOwner: 'builders/deployment-tool',
    url: 'https://github.com/builders/deployment-tool',
    description: null,
    primaryLanguage: {
      name: 'Rust',
    },
    createdAt: '2024-12-06T17:25:00Z',
    stargazerCount: 1,
    owner: {
      __typename: 'User',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
];
