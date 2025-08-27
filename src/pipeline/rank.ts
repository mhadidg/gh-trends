import { franc } from 'franc';
import { logInfo, logWarn } from '../utils/logging';
import { clamp, daysSince, hoursSince } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';

export interface ScoredRepo extends GithubRepo {
  score: number;
}

export function rank(repos: GithubRepo[]): ScoredRepo[] {
  const minStars = parseInt(process.env.RELEASE_MIN_STARS || '50');

  return repos
    .filter(repo => {
      const repoName = repo.nameWithOwner;

      // Catch scam repos (mostly crypto wallet drainers)
      if (daysSince(repo.owner.createdAt) < 30 && repo.owner.__typename === 'User') {
        logWarn('score', `presumably malware (fresh owner), skipping: ${repoName}`);
        return false;
      }

      // Apply minimum stars filter
      if (repo.stargazerCount < minStars) {
        logInfo('score', `${repo.stargazerCount} star(s) only, skipping: ${repoName}`);
        return false;
      }

      // High-quality repo with no desc? Happy to take the risks
      if (repo.description === null || repo.description.trim() === '') {
        logWarn('score', `presumably low quality (empty desc), skipping: ${repoName}`);
        return false;
      }

      const lang = franc(repo.description);
      // NOTE: I'd rather filter by English only, but lang detection is flawed,
      // especially for short text (3-5 words). Chinese is the biggest non-English
      // spoken language on GitHub, so let's just block it (with love).
      if (lang === 'cmn') {
        logWarn('score', `Chinese repo, skipping: ${repoName}`);
        return false;
      }

      return true;
    })
    .map(function (repo) {
      const maxHours = parseInt(process.env.SCAN_WINDOW_DAYS || '7') * 24;
      const hoursSinceFirstSeen = clamp(hoursSince(repo.clickhouse.firstSeenAt), 1, maxHours);
      return { ...repo, score: repo.clickhouse.starsWithin / hoursSinceFirstSeen };
    })
    .sort((a, b) => b.score - a.score);
}
