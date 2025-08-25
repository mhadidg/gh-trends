import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../src/utils/logging';
import { ButtondownPublisher } from '../../../src/publishers/buttondown';
import { ButtondownClient } from '../../../src/clients/buttondown';
import { mockRepos } from '../../../src/mocks/repos';
import { ScoredRepo } from '../../../src/pipeline/rank';

describe('buttondown.ts', () => {
  const mockFetch = vi.fn();
  let instance: ButtondownPublisher;

  const content = 'hello world';
  const repos: ScoredRepo[] = mockRepos.map(repo => ({ ...repo, score: 0 }));

  beforeEach(() => {
    instance = new ButtondownPublisher();
    vi.spyOn(instance, 'render').mockReturnValue(content);
    global.fetch = mockFetch as typeof fetch;
    vi.clearAllMocks(); // reset mocks
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('enabled', () => {
    it('should return false when SEND_ENABLED is false', async () => {
      vi.stubEnv('SEND_ENABLED', 'false');

      expect(instance.enabled()).toBe(false);
    });

    it('should return false when SEND_ENABLED is undefined', async () => {
      vi.stubEnv('SEND_ENABLED', undefined);

      expect(instance.enabled()).toBe(false);
    });

    it('should return true when SEND_ENABLED is true', async () => {
      vi.stubEnv('SEND_ENABLED', 'true');

      expect(instance.enabled()).toBe(true);
    });
  });

  describe('publish.config', () => {
    it('should throw when BUTTONDOWN_API_KEY is missing', async () => {
      vi.stubEnv('BUTTONDOWN_API_KEY', undefined);

      await expect(instance.publish(repos)).rejects.toThrow('BUTTONDOWN_API_KEY');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when BUTTONDOWN_API_KEY is empty', async () => {
      vi.stubEnv('BUTTONDOWN_API_KEY', '');

      await expect(instance.publish(repos)).rejects.toThrow('BUTTONDOWN_API_KEY');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    const token = 'bd_live_key_123';

    beforeEach(() => {
      vi.stubEnv('BUTTONDOWN_API_KEY', token);
    });

    it('should make well-formed request', async () => {
      const id = 'bd_test_id';

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id }),
      });

      await expect(instance.publish(repos)).resolves.toBe(id);

      expect(mockFetch).toHaveBeenCalledWith(
        ButtondownClient.baseUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
          }),
        })
      );

      const [, options] = mockFetch.mock.calls[0]!;
      const parsedBody = JSON.parse(options.body as string);
      expect(parsedBody).toEqual({
        subject: instance.subject(),
        body: content,
        email_type: 'public',
      });
    });

    it('should accept missing ID', async () => {
      // Unexpected, but we put good faith on 200 OK
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // no id
      });

      await expect(instance.publish(repos)).resolves.toBeUndefined();
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
