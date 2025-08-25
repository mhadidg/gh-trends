import { readFileSync, writeFileSync, existsSync } from 'fs';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { Publisher } from '../types/publisher';
import { logInfo } from '../utils/logging';
import { ScoredRepo } from '../pipeline/rank';

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

export class RSSPublisher extends Publisher {
  readonly name = 'rss';
  private readonly rssPath: string;
  private readonly windowDays: number;
  private parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });
  private builder = new XMLBuilder({ ignoreAttributes: false, format: true });

  constructor(rssPath: string = 'feed/rss.xml', windowDays: number = 7) {
    super();
    this.rssPath = rssPath;
    this.windowDays = windowDays;
  }

  enabled(): boolean {
    return process.env.RSS_ENABLED === 'true';
  }

  async publish(repos: ScoredRepo[]): Promise<string> {
    const existingItems = this.loadExistingItems();
    const newItems = this.createRSSItems(repos);

    const dedupedItems = this.dedupeItems(existingItems, newItems);
    const filteredItems = this.filterByWindow(dedupedItems);

    const addedCount = filteredItems.length - existingItems.length;
    logInfo('rss', `feed updated: received ${newItems.length}, added ${addedCount}`);

    this.writeRSSFeed(filteredItems);

    return `rss-${Date.now()}`;
  }

  private loadExistingItems(): RSSItem[] {
    if (!existsSync(this.rssPath)) {
      return [];
    }

    try {
      const content = readFileSync(this.rssPath, 'utf-8');
      const parsed = this.parser.parse(content);
      const channel = parsed.rss?.channel;

      if (!channel?.item) {
        return [];
      }

      const items = Array.isArray(channel.item) ? channel.item : [channel.item];
      return items
        .map((item: RSSItem) => ({
          title: item.title,
          link: item.link,
          description: item.description,
          pubDate: item.pubDate,
          guid: typeof item.guid === 'object' ? item.guid['#text'] : item.guid || '',
        }))
        .filter((item: RSSItem) => item.title && item.link && item.guid);
    } catch {
      logInfo('rss', 'failed to parse existing RSS feed, starting fresh');
      return [];
    }
  }

  private createRSSItems(repos: ScoredRepo[]): RSSItem[] {
    const now = new Date();

    return repos.map(repo => ({
      title: repo.nameWithOwner,
      link: repo.url,
      description: repo.description || '(no description)',
      pubDate: now.toUTCString(),
      guid: repo.nameWithOwner,
    }));
  }

  private dedupeItems(existing: RSSItem[], newItems: RSSItem[]): RSSItem[] {
    const existingGuids = new Set(existing.map(item => item.guid));
    const uniqueNewItems = newItems.filter(item => !existingGuids.has(item.guid));

    return [...existing, ...uniqueNewItems];
  }

  private filterByWindow(items: RSSItem[]): RSSItem[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.windowDays);

    return items.filter(item => {
      const pubDate = new Date(item.pubDate);
      return pubDate >= cutoff;
    });
  }

  private writeRSSFeed(items: RSSItem[]): void {
    const sortedItems = items.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const rssObj = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      rss: {
        '@_version': '2.0',
        channel: {
          title: 'GitHub trends',
          link: 'https://github.com/mhadidg/gh-trends',
          description: 'Curated list of trending GitHub repositories',
          language: 'en-us',
          lastBuildDate: new Date().toUTCString(),
          generator: 'gh-trends-newsletter',
          item: sortedItems.map(item => ({
            title: item.title,
            link: item.link,
            description: item.description,
            pubDate: item.pubDate,
            guid: {
              '@_isPermaLink': 'false',
              '#text': item.guid,
            },
          })),
        },
      },
    };

    const rssContent = this.builder.build(rssObj);
    writeFileSync(this.rssPath, rssContent, 'utf-8');
  }
}
