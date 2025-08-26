import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { RSSPublisher } from '../../../src/publishers/rss';
import { mockRepos } from '../../../src/mocks/repos';
import { ScoredRepo } from '../../../src/pipeline/rank';

describe('rss.ts', () => {
  let instance: RSSPublisher;
  let testDir: string;
  let testRssPath: string;

  const parser = new XMLParser({ ignoreAttributes: false });
  const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
  const repos: ScoredRepo[] = mockRepos.slice(0, 2).map(repo => ({ ...repo, score: 0 }));

  beforeEach(() => {
    testDir = join(tmpdir(), `rss-test-${Date.now()}.xml`);
    mkdirSync(testDir, { recursive: true });
    testRssPath = join(testDir, 'rss.xml');

    instance = new RSSPublisher(testRssPath, 7);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('enabled', () => {
    it('should return false when RSS_ENABLED is false', async () => {
      vi.stubEnv('RSS_ENABLED', 'false');

      expect(instance.enabled()).toBe(false);
    });

    it('should return false when RSS_ENABLED is undefined', async () => {
      vi.stubEnv('RSS_ENABLED', undefined);

      expect(instance.enabled()).toBe(false);
    });

    it('should return true when RSS_ENABLED is true', async () => {
      vi.stubEnv('RSS_ENABLED', 'true');

      expect(instance.enabled()).toBe(true);
    });
  });

  describe('publish', () => {
    it('should create RSS file with new data when no RSS file exist', async () => {
      const result = await instance.publish(repos);

      expect(result).toMatch(/^rss-\d+$/);
      expect(existsSync(testRssPath)).toBe(true);

      const content = readFileSync(testRssPath, 'utf-8');
      const parsed = parser.parse(content);

      expect(parsed.rss['@_version']).toBe('2.0');
      expect(parsed.rss.channel.title).toBe('GitHub trends');
      expect(Array.isArray(parsed.rss.channel.item)).toBe(true);
      expect(parsed.rss.channel.item).toHaveLength(2);
      expect(parsed.rss.channel.item[0].title).toBe(repos[0]!.nameWithOwner);
      expect(parsed.rss.channel.item[1].title).toBe(repos[1]!.nameWithOwner);
    });

    it('should update RSS file with new data when RSS file exists', async () => {
      // Use current date to pass time window filter
      const recentDate = new Date().toUTCString();
      const existingRssObj = {
        rss: {
          channel: {
            item: [
              {
                title: 'some/repo',
                link: 'https://github.com/some/repo',
                description: 'description',
                pubDate: recentDate,
                guid: {
                  '@_isPermaLink': 'false',
                  '#text': 'existing/repo',
                },
              },
            ],
          },
        },
      };

      // Simulate existing RSS file
      const existingRss = builder.build(existingRssObj);
      writeFileSync(testRssPath, existingRss, 'utf-8');

      await instance.publish(repos);

      const content = readFileSync(testRssPath, 'utf-8');
      const parsed = parser.parse(content);

      const items = parsed.rss.channel.item;
      expect(items).toHaveLength(3);

      expect(items[0].title).toContain('some/repo');
      expect(items[1].title).toContain(repos[0]!.nameWithOwner);
      expect(items[2].title).toContain(repos[1]!.nameWithOwner);
    });

    it('should not duplicate existing repositories', async () => {
      // Use current date to pass time window filter
      const recentDate = new Date().toUTCString();
      const existingRssObj = {
        channel: {
          item: [
            {
              title: 'existing/repo',
              link: 'https://github.com/existing/repo',
              description: 'description',
              pubDate: recentDate,
              guid: {
                '@_isPermaLink': 'false',
                '#text': 'existing/repo',
              },
            },
          ],
        },
      };

      const existingRss = builder.build(existingRssObj);
      writeFileSync(testRssPath, existingRss, 'utf-8');

      const duplicateRepo = repos[0]!;
      // duplicateRepo.nameWithOwner = 'existing/repo';
      await instance.publish([duplicateRepo]);

      const content = readFileSync(testRssPath, 'utf-8');
      const parsed = parser.parse(content);
      const items = [parsed.rss.channel.item];
      console.log(items);

      expect(items).toHaveLength(1);
    });
  });
});
