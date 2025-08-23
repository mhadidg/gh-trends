import { TaggedError } from '../utils/logging';
import { weekNumber } from '../utils/common';
import { Publisher } from '../types/publisher';
import { GitHubClient } from '../clients/github';

export class GitHubReleasePublisher extends Publisher {
  readonly name = 'github-releases';

  enabled(): boolean {
    return process.env.GITHUB_RELEASES_ENABLED === 'true';
  }

  async publish(content: string): Promise<string> {
    const repo = process.env.GITHUB_RELEASES_REPO;

    if (!repo) {
      throw new TaggedError(
        'config',
        'GITHUB_RELEASES_REPO required when GITHUB_RELEASES_ENABLED=true'
      );
    }

    const client = new GitHubClient(process.env.GITHUB_TOKEN);
    const result = await client.createRelease(repo, {
      tag_name: this.releaseTag(),
      name: this.subject(),
      body: content,
      draft: false,
      prerelease: false,
    });

    return result.id;
  }

  private releaseTag(): string {
    const now = new Date();
    const year = now.getFullYear();
    const week = weekNumber(now);
    return `release-${year}-W${week.toString().padStart(2, '0')}`;
  }
}
