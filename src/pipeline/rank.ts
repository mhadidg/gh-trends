import { franc } from 'franc';
import { logInfo, logWarn } from '../utils/logging';
import { hoursSince } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';

export interface ScoredRepo extends GithubRepo {
  score: number;
}

export function rank(repos: GithubRepo[]): ScoredRepo[] {
  const limit = parseInt(process.env.RELEASE_TOP_N || '20');
  const minStars = parseInt(process.env.RELEASE_MIN_STARS || '50');

  return repos
    .filter(repo => {
      const repoName = repo.nameWithOwner;

      // Apply minimum stars filter
      if (repo.stargazerCount < minStars) {
        logInfo('score', `${repo.stargazerCount} star(s) only, skipping: ${repoName}`);
        return false;
      }

      // High-quality repo with no desc? Happy to take the risks
      if (repo.description === null || repo.description.trim() === '') {
        logWarn('score', `empty description, skipping: ${repoName}`);
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
    .map(repo => ({ ...repo, score: repo.stargazerCount / hoursSince(repo.createdAt) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
