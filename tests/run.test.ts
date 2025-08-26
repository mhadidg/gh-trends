import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main, run } from '../src/run';
import { HttpError, TaggedError } from '../src/utils/logging';
import { ClickHouseClient, ClickHouseResponse } from '../src/clients/clickhouse';
import { mockRepos } from '../src/mocks/repos';
import { GitHubGraphQLClient } from '../src/clients/github.gql';
import { GitHubClient } from '../src/clients/github';
import { ButtondownClient } from '../src/clients/buttondown';

describe('run.ts', () => {
  let realFetch: typeof fetch;

  beforeEach(async () => {
    vi.clearAllMocks();

    realFetch = global.fetch;

    vi.spyOn(global, 'fetch').mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();

        // Sending email via Buttondown
        if (url.includes(ButtondownClient.baseUrl)) {
          return new Response(JSON.stringify({ id: 'test-123', status: 'scheduled' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Querying ClickHouse playground
        if (url.includes(ClickHouseClient.baseUrl)) {
          const response = {
            data: [{ repo_name: 'repo', appeared_at: '' }],
            statistics: { rows_read: 2 },
          } as ClickHouseResponse;

          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Fetching GitHub repository details
        if (url.includes(GitHubGraphQLClient.endpoint)) {
          const response = {
            r0: mockRepos[0],
            r1: mockRepos[1],
          };

          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Creating a GitHub release
        if (url.includes(GitHubClient.baseUrl) && url.includes('/releases')) {
          return new Response(JSON.stringify({ id: 12345 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Delegate to the real fetch for everything else
        return realFetch(input, init);
      }
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Pipeline execution', () => {
    beforeEach(async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('BUTTONDOWN_ENABLED', 'true');
      vi.stubEnv('BUTTONDOWN_API_KEY', 'bd_live_key_123');
      vi.stubEnv('GITHUB_RELEASES_ENABLED', 'true');
      vi.stubEnv('GITHUB_RELEASES_REPO', 'test/repo');
      vi.stubEnv('GITHUB_TOKEN', 'ghp_test_token_123');
    });

    it('should run successfully', async () => {
      await expect(main()).resolves.not.toThrow();
    });

    it('should logs HTTP errors', async () => {
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.spyOn(global, 'fetch').mockRejectedValue(
        new HttpError('tag', 'message', new Response(null, { status: 500 }))
      );

      await expect(run()).resolves.not.toThrow();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('message'));
    });

    it('should logs tagged errors', async () => {
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.spyOn(global, 'fetch').mockRejectedValue(new TaggedError('tag', 'message'));

      await expect(run()).resolves.not.toThrow();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('message'));
    });

    it('should throw unhandled errors', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('message'));

      await expect(run()).rejects.toThrow('message');
    });
  });
});
