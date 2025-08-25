import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishAll } from '../../src/pipeline/publish';
import { mockRepos } from '../../src/mocks/repos';
import { ScoredRepo } from '../../src/pipeline/rank';

const publisher01 = {
  name: 'publisher-01',
  enabled: vi.fn().mockReturnValue(false),
  subject: vi.fn().mockReturnValue('subject'),
  render: vi.fn().mockReturnValue('content'),
  publish: vi.fn(),
};

const publisher02 = {
  name: 'publisher-02',
  enabled: vi.fn().mockReturnValue(false),
  subject: vi.fn().mockReturnValue('subject'),
  render: vi.fn().mockReturnValue('content'),
  publish: vi.fn(),
};

const pubs = [publisher01, publisher02];

describe('publish.ts', () => {
  const repos: ScoredRepo[] = mockRepos.map(repo => ({ ...repo, score: 0 }));

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should handle zero publisher enabled', async () => {
    const result = await publishAll(repos, pubs);

    expect(result).toEqual([]);
    expect(publisher01.publish).not.toHaveBeenCalled();
    expect(publisher02.publish).not.toHaveBeenCalled();
  });

  it('should call only the enabled publishers', async () => {
    publisher01.enabled.mockReturnValue(true);
    publisher01.publish.mockResolvedValueOnce('bd_123');

    const result = await publishAll(repos, pubs);

    expect(result).toEqual(['bd_123']);
    expect(publisher01.publish).toHaveBeenCalledWith(repos);
    expect(publisher02.publish).not.toHaveBeenCalled();
  });

  it('should call multiple publishers when enabled', async () => {
    publisher01.enabled.mockReturnValue(true);
    publisher02.enabled.mockReturnValue(true);
    publisher01.publish.mockResolvedValueOnce('bd_123');
    publisher02.publish.mockResolvedValueOnce('gh_456');

    const result = await publishAll(repos, pubs);

    expect(result).toEqual(['bd_123', 'gh_456']);
  });

  it('should throw when one of the publisher fails', async () => {
    publisher01.enabled.mockReturnValue(true);
    publisher02.enabled.mockReturnValue(true);

    publisher01.publish.mockRejectedValueOnce(new Error('publisher-01'));
    publisher02.publish.mockResolvedValueOnce('gh_456');

    await expect(publishAll(repos, pubs)).rejects.toThrow('publisher-01');
  });

  it('should throw when multiple publishers fail (first error wins)', async () => {
    publisher01.enabled.mockReturnValue(true);
    publisher02.enabled.mockReturnValue(true);

    publisher01.publish.mockRejectedValueOnce(new Error('publisher-01'));
    publisher02.publish.mockRejectedValueOnce(new Error('publisher-02'));

    await expect(publishAll(repos, pubs)).rejects.toThrow('publisher-01');
  });
});
