// tests/providers/resend.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../src/utils/logging';
import { ResendPublisher } from '../../src/publishers/resend';
import { ResendClient } from '../../src/clients/resend';
import { mockRepos } from '../../src/mocks/repos';
import { ScoredRepo } from '../../src/pipeline/rank';

describe('resend.ts', () => {
  const mockFetch = vi.fn();
  let instance: ResendPublisher;

  const content = 'hello world';
  const repos: ScoredRepo[] = mockRepos.map(repo => ({ ...repo, score: 0 }));

  beforeEach(() => {
    instance = new ResendPublisher();
    vi.spyOn(instance, 'render').mockReturnValue(content);
    global.fetch = mockFetch as unknown as typeof fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('enabled', () => {
    it('should return false when RESEND_ENABLED is false', () => {
      vi.stubEnv('RESEND_ENABLED', 'false');

      expect(instance.enabled()).toBe(false);
    });

    it('should return false when RESEND_ENABLED is undefined', () => {
      vi.stubEnv('RESEND_ENABLED', undefined);

      expect(instance.enabled()).toBe(false);
    });

    it('should return true when RESEND_ENABLED is true', () => {
      vi.stubEnv('RESEND_ENABLED', 'true');

      expect(instance.enabled()).toBe(true);
    });
  });

  describe('publish.config', () => {
    it('should throw when RESEND_FROM is missing', async () => {
      vi.stubEnv('RESEND_FROM', undefined);
      vi.stubEnv('RESEND_AUDIENCE_ID', 'aud_123');
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_FROM');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_FROM is empty', async () => {
      vi.stubEnv('RESEND_FROM', '');
      vi.stubEnv('RESEND_AUDIENCE_ID', 'aud_123');
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_FROM');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_AUDIENCE_ID is missing', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_AUDIENCE_ID', undefined);
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_AUDIENCE_ID');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_AUDIENCE_ID is empty', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_AUDIENCE_ID', '');
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_AUDIENCE_ID');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_API_KEY is missing', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_AUDIENCE_ID', 'aud_123');
      vi.stubEnv('RESEND_API_KEY', undefined);

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_API_KEY');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_API_KEY is empty', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_AUDIENCE_ID', 'aud_123');
      vi.stubEnv('RESEND_API_KEY', '');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_API_KEY');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    const token = 're_live_key_123';
    const from = 'GitHub Trends <newsletter@example.com>';
    const audienceId = 'aud_abc123';

    beforeEach(() => {
      vi.stubEnv('RESEND_API_KEY', token);
      vi.stubEnv('RESEND_FROM', from);
      vi.stubEnv('RESEND_AUDIENCE_ID', audienceId);
    });

    it('should make well-formed requests (draft then send)', async () => {
      const id = 're_bc_001';

      // Create draft broadcast
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id }),
        })
        // Then send it
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ status: 'sent' }),
        });

      await expect(instance.publish(repos)).resolves.toBe(id);

      // 1st request: create broadcast
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        ResendClient.baseUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }),
        })
      );

      const [, draftOpts] = mockFetch.mock.calls[0]!;
      const draftBody = JSON.parse(draftOpts!.body as string);
      expect(draftBody).toEqual({
        from,
        audience_id: audienceId,
        subject: instance.subject(),
        name: instance.subject(),
        html: content,
      });

      // 2nd request: send
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        `${ResendClient.baseUrl}/${id}/send`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should support draft mode (no send when RESEND_DRAFT=true)', async () => {
      const id = 're_bc_002';
      vi.stubEnv('RESEND_DRAFT', 'true');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id }),
      });

      await expect(instance.publish(repos)).resolves.toBe(id);

      // Only one call (no /send)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        ResendClient.baseUrl,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw when drafting returns no ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // no id
      });

      await expect(instance.publish(repos)).rejects.toThrowError(HttpError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on JSON parsing errors (draft response)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
      });

      await expect(instance.publish(repos)).rejects.toThrow('invalid JSON');
    });

    it('should throw on 5xx HTTP error (draft request)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('internal server error'),
      });

      await expect(instance.publish(repos)).rejects.toThrowError(HttpError);
    });

    it('should throw on 5xx HTTP error (send request)', async () => {
      const id = 're_bc_003';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: vi.fn().mockResolvedValue('internal server error'),
        });

      await expect(instance.publish(repos)).rejects.toThrowError(HttpError);
    });

    it('should throw on network errors (draft request)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network down'));

      await expect(instance.publish(repos)).rejects.toThrow('network down');
    });

    it('should throw on network errors (send request)', async () => {
      const id = 're_bc_004';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id }),
        })
        .mockRejectedValueOnce(new Error('network down'));

      await expect(instance.publish(repos)).rejects.toThrow('network down');
    });
  });
});
