import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scan } from '../../src/pipeline/scan';
import { HttpError } from '../../src/utils/logging';
import { GitHubErrorItem, GitHubGraphQLClient, GithubRepo } from '../../src/clients/github.gql';
import { mockRepos } from '../../src/mocks/repos';
import { ClickHouseClient } from '../../src/clients/clickhouse';

describe('scan.ts', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.clearAllMocks(); // reset mocks
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('mocking', () => {
    it('should return mock data in test', async () => {
      await scan();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return mock data in development', async () => {
      vi.stubEnv('USE_MOCK_REPOS', 'true');

      await scan();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return mock data when USE_MOCK_REPOS is undefined', async () => {
      vi.stubEnv('USE_MOCK_REPOS', undefined);

      await scan();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('clickhouse-api', () => {
    beforeEach(() => {
      vi.stubEnv('USE_MOCK_REPOS', 'false');
      vi.stubEnv('GITHUB_TOKEN', 'ghp_valid_token_123');
    });

    it('should make well-formed request', async () => {
      vi.stubEnv('SCAN_WINDOW_DAYS', '7');
      vi.stubEnv('SCAN_LIMIT', '10');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [], statistics: [] }),
      });

      await scan();

      const [url, options] = mockFetch.mock.calls[0] as Parameters<typeof fetch>;

      expect(url).toBe(ClickHouseClient.baseUrl);
      expect(options!.method).toBe('POST');
      expect(options!.body).toContain('INTERVAL 7 DAY');
      expect(options!.body).toContain('10 AS LIMIT_N');
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [], statistics: [] }),
      });

      const result = await scan();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should throw on JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
      });

      await expect(scan()).rejects.toThrow('invalid JSON');
    });

    it('should throw on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));

      await expect(scan()).rejects.toThrow('network error');
    });

    it('should throw on 5xx HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(scan()).rejects.toThrowError(HttpError);
    });
  });

  describe('github-api', () => {
    beforeEach(() => {
      vi.stubEnv('USE_MOCK_REPOS', 'false');
      vi.stubEnv('GITHUB_TOKEN', 'ghp_valid_token_123');
    });

    it('should throw when GITHUB_TOKEN is missing', async () => {
      vi.stubEnv('GITHUB_TOKEN', undefined);

      await expect(scan()).rejects.toThrow('GITHUB_TOKEN required');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when GITHUB_TOKEN is empty', async () => {
      vi.stubEnv('GITHUB_TOKEN', '');

      await expect(scan()).rejects.toThrow('GITHUB_TOKEN required');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should make well-formed request', async () => {
      // Mock ClickHouse API first
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          // At least one result is required to trigger GitHub API
          json: vi.fn().mockResolvedValue({
            data: [{ repo_name: 'test/repo', appeared_at: '2025-08-16 18:48:25' }],
            statistics: { rows_read: 1000 },
          }),
        })
        // Then mock GitHub API
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        });

      await scan();

      expect(mockFetch).toHaveBeenNthCalledWith(
        2, // second call for GitHub API
        GitHubGraphQLClient.endpoint,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('repository(owner: \\"test\\", name: \\"repo\\")'),
          headers: expect.objectContaining({
            Authorization: 'Bearer ghp_valid_token_123',
            Accept: 'application/vnd.github+json',
          }),
        })
      );
    });

    it('should handle missing optional fields', async () => {
      // Mock ClickHouse API
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            // At least one result is required to trigger GitHub API
            data: [{ repo_name: 'test/repo', appeared_at: '2025-08-16 18:48:25' }],
            statistics: { rows_read: 1000 },
          }),
        })
        // Then mock GitHub API
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: {
              r0: {
                ...mockRepos[0],
                description: null, // optional
                primaryLanguage: null, // optional
              },
            } as Record<string, GithubRepo>,
          }),
        });

      const result = await scan();

      expect(result).toHaveLength(1);
      expect(result[0]!.primaryLanguage).toBeNull();
      expect(result[0]!.description).toBeNull();
    });

    it('should enrich ClickHouse result', async () => {
      // Mock ClickHouse API
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            statistics: { rows_read: 1000 },
            data: [
              { repo_name: 'owner1/repo1', appeared_at: '2025-08-16 18:48:25' },
              { repo_name: 'owner2/repo2', appeared_at: '2025-08-16 18:48:25' },
            ],
          }),
        })
        // Then mock GitHub API
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: {
              r0: {
                ...mockRepos[0],
                nameWithOwner: 'owner1/repo1',
                description: 'first repo',
                stargazerCount: 150,
                primaryLanguage: { name: 'JavaScript' },
              },
              r1: {
                ...mockRepos[0],
                nameWithOwner: 'owner2/repo2',
                description: 'second repo',
                stargazerCount: 200,
                primaryLanguage: { name: 'Python' },
              },
            } as Record<string, GithubRepo>,
          }),
        });

      const result = await scan();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        nameWithOwner: 'owner1/repo1',
        description: 'first repo',
        stargazerCount: 150,
        primaryLanguage: { name: 'JavaScript' },
      });

      expect(result[1]).toMatchObject({
        nameWithOwner: 'owner2/repo2',
        description: 'second repo',
        stargazerCount: 200,
        primaryLanguage: { name: 'Python' },
      });
    });

    it('should handle no longer exist repos', async () => {
      // Mock ClickHouse API
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            statistics: { rows_read: 1000 },
            data: [
              { repo_name: 'owner1/repo1', appeared_at: '2025-08-16 18:48:25' },
              { repo_name: 'deleted/repo', appeared_at: '2025-08-16 18:48:25' },
            ],
          }),
        })
        // Then mock GitHub API
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: {
              r0: {
                ...mockRepos[0],
                nameWithOwner: 'owner1/repo1',
                description: null, // optional
                primaryLanguage: null, // optional
              },
            } as Record<string, GithubRepo>,
            errors: [
              {
                type: 'NOT_FOUND',
                message: 'Could not resolve repo deleted/repo',
              },
            ] as GitHubErrorItem[],
          }),
        });

      const result = await scan();

      expect(result).toHaveLength(1);
      expect(result[0]!.nameWithOwner).toBe('owner1/repo1');
    });

    it('should throw on JSON parsing errors', async () => {
      // Mock ClickHouse API first
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          // At least one result is required to trigger GitHub API
          json: vi.fn().mockResolvedValue({
            data: [{ repo_name: 'test/repo', appeared_at: '2025-08-16 18:48:25' }],
            statistics: { rows_read: 1000 },
          }),
        })
        // Then mock GitHub API
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
        });

      await expect(scan()).rejects.toThrow('invalid JSON');
    });

    it('should throw on network errors', async () => {
      // Mock ClickHouse API first
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          // At least one result is required to trigger GitHub API
          json: vi.fn().mockResolvedValue({
            data: [{ repo_name: 'test/repo', appeared_at: '2025-08-16 18:48:25' }],
            statistics: { rows_read: 1000 },
          }),
        })
        // Then mock GitHub API
        .mockRejectedValue(new Error('network error'));

      await expect(scan()).rejects.toThrow('network error');
    });

    it('should throw on 5xx HTTP error', async () => {
      // Mock ClickHouse API
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          // At least one result is required to trigger GitHub API
          json: vi.fn().mockResolvedValue({
            data: [{ repo_name: 'test/repo', appeared_at: '2025-08-16 18:48:25' }],
            statistics: { rows_read: 1000 },
          }),
        })
        // Then mock GitHub API
        .mockResolvedValueOnce({
          ok: false,
          text: vi.fn().mockResolvedValue('internal server error'),
          status: 500,
        });

      await expect(scan()).rejects.toThrowError(HttpError);
    });
  });
});
