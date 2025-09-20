import { ButtondownPublisher } from '../publishers/buttondown';
import { GitHubPublisher } from '../publishers/github';
import { RSSPublisher } from '../publishers/rss';
import { logInfo } from '../utils/logging';
import { Publisher } from '../types/publisher';
import { ResendPublisher } from '../publishers/resend';
import { ScoredRepo } from './select';

const publishers = [
  // Executes in order
  new ButtondownPublisher(),
  new ResendPublisher(),
  new GitHubPublisher(),
  new RSSPublisher(),
];

export async function publishAll(
  repos: ScoredRepo[],
  // Don't use below argument in production code
  // Enables injecting custom publishers for testing
  pubs: Publisher[] = publishers
): Promise<string[]> {
  const enabledPubs = pubs.filter(pub => pub.enabled());

  if (enabledPubs.length === 0) {
    logInfo('publish', 'no publishers enabled, skipping publication');
    return [];
  }

  if (repos.length === 0) {
    logInfo('publish', 'no repositories to publish, skipping publication');
    return [];
  }

  logInfo('publish', `starting publication via ${enabledPubs.map(p => p.name).join(', ')}`);

  // Run all publishers in parallel
  // Promise.allSettled always resolve, even if some promises reject
  const results = await Promise.allSettled(
    enabledPubs.map(async pub => {
      logInfo('publish', `publishing via ${pub.name}`);
      const messageId = await pub.publish(repos);
      logInfo('publish', `${pub.name} published successfully (ID: ${messageId})`);
      return messageId;
    })
  );

  const messageIds: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;

    if (result.status === 'fulfilled') {
      messageIds.push(result.value);
    } else {
      throw result.reason;
    }
  }

  return messageIds;
}
