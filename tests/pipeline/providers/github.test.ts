import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, TaggedError } from '../../../src/utils/logging';
import { GitHubPublisher } from '../../../src/publishers/github';
import { mockRepos } from '../../../src/mocks/repos';
import { ScoredRepo } from '../../../src/pipeline/rank';
import { GitHubClient } from '../../../src/clients/github';

describe('gh-release.ts', () => {
  const mockFetch = vi.fn();
  let instance: GitHubPublisher;

  const content = 'Hello world';
  const repos: ScoredRepo[] = mockRepos.map(repo => ({ ...repo, score: 0 }));

  beforeEach(() => {
    instance = new GitHubPublisher();
    vi.spyOn(instance, 'render').mockReturnValue(content);
    global.fetch = mockFetch as typeof fetch;
    vi.clearAllMocks(); // reset mocks
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('enabled', () => {
    it('should return false when GITHUB_RELEASES_ENABLED is false', async () => {
      vi.stubEnv('GITHUB_RELEASES_ENABLED', 'false');

      expect(instance.enabled()).toBe(false);
    });

    it('should return false when GITHUB_RELEASES_ENABLED is undefined', async () => {
      vi.stubEnv('GITHUB_RELEASES_ENABLED', undefined);

      expect(instance.enabled()).toBe(false);
    });

    it('should return true when GITHUB_RELEASES_ENABLED is true', async () => {
      vi.stubEnv('GITHUB_RELEASES_ENABLED', 'true');

      expect(instance.enabled()).toBe(true);
    });
  });

  describe('config', () => {
    it('should throw when GITHUB_TOKEN is missing', async () => {
      vi.stubEnv('GITHUB_RELEASES_REPO', 'example/repo');
      vi.stubEnv('GITHUB_TOKEN', undefined);

      await expect(instance.publish(repos)).rejects.toThrow('GITHUB_TOKEN');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when GITHUB_TOKEN is empty', async () => {
      vi.stubEnv('GITHUB_RELEASES_REPO', 'example/repo');
      vi.stubEnv('GITHUB_TOKEN', '');

      await expect(instance.publish(repos)).rejects.toThrow('GITHUB_TOKEN');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when GITHUB_RELEASES_REPO is missing', async () => {
      vi.stubEnv('GITHUB_RELEASES_REPO', undefined);

      await expect(instance.publish(repos)).rejects.toThrow('GITHUB_RELEASES_REPO');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when GITHUB_RELEASES_REPO is missing', async () => {
      vi.stubEnv('GITHUB_RELEASES_REPO', '');

      await expect(instance.publish(repos)).rejects.toThrow('GITHUB_RELEASES_REPO');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    const repo = 'example/repo';
    const token = 'ghp_valid_token_123';

    beforeEach(() => {
      vi.stubEnv('GITHUB_TOKEN', token);
      vi.stubEnv('GITHUB_RELEASES_REPO', repo);
    });

    it('should make well-formed request', async () => {
      const id = 99;

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id }),
      });

      await expect(instance.publish(repos)).resolves.toBe(id.toString());

      expect(mockFetch).toHaveBeenCalledWith(
        `${GitHubClient.baseUrl}/repos/${repo}/releases`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          }),
        })
      );

      const [, options] = mockFetch.mock.calls[0]!;
      const parsedBody = JSON.parse(options.body as string);
      expect(parsedBody).toEqual({
        tag_name: expect.stringMatching(/^release-\d{4}-W\d{2}$/), // e.g. release-2025-W33
        name: instance.subject(),
        body: content,
        draft: false,
        prerelease: false,
      });
    });

    it('should throw on missing ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // no id
      });

      await expect(instance.publish(repos)).rejects.toThrowError(TaggedError);
    });

    it('should throw on JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
      });

      await expect(instance.publish(repos)).rejects.toThrow('invalid JSON');
    });

    it('should throw on 5xx HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('internal server error'),
      });

      await expect(instance.publish(repos)).rejects.toThrowError(HttpError);
    });

    it('should throw on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('network down'));

      await expect(instance.publish(repos)).rejects.toThrow('network down');
    });
  });
});
