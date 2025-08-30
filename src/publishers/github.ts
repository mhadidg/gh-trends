import { TaggedError } from '../utils/logging';
import { Publisher } from '../types/publisher';
import { render } from '../pipeline/render';
import { GitHubClient } from '../clients/github';
import { ScoredRepo } from '../pipeline/rank';

export class GitHubPublisher extends Publisher {
  readonly name = 'github-releases';

  // The date of the very first issue; happen to be my birthday!
  readonly epoch = '2025-07-21';

  enabled(): boolean {
    return process.env.GITHUB_RELEASES_ENABLED === 'true';
  }

  render(repos: ScoredRepo[]): string {
    return render('markdown.hbs', repos);
  }

  async publish(repos: ScoredRepo[]): Promise<string> {
    const repo = process.env.GITHUB_RELEASES_REPO;

    if (!repo) {
      throw new TaggedError(
        'config',
        'GITHUB_RELEASES_REPO required when GITHUB_RELEASES_ENABLED=true'
      );
    }

    const content = this.render(repos);
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

  subject(): string {
    return `GitHub trends #${this.issueNumber()}`;
  }

  private releaseTag(): string {
    return `week-${this.issueNumber().toString().padStart(2, '0')}`;
  }

  private issueNumber(): number {
    const start = new Date(this.epoch);
    const now = new Date();

    // Calculate weeks since start
    const MillisInWeek = 1000 * 60 * 60 * 24 * 7;
    const diffInMillis = now.getTime() - start.getTime();

    if (diffInMillis < 0) {
      throw new Error('Release date is in the future. Cannot calculate issue number.');
    }

    const weeksPassed = Math.floor(diffInMillis / MillisInWeek);
    return weeksPassed + 1;
  }
}
