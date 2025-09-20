import { clamp, daysSince, hoursSince, median } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';
import { logInfo } from '../utils/logging';

export interface ScoredRepo extends GithubRepo {
  score: number;
}

export function select(repos: GithubRepo[]): ScoredRepo[] {
  const topN = parseInt(process.env.RELEASE_TOP_N!);

  const ranked = repos
    .map(repo => {
      const maxHours = parseInt(process.env.SCAN_WINDOW_DAYS!) * 24;
      const hoursSinceFirstSeen = clamp(hoursSince(repo.clickhouse.firstSeenAt), 1, maxHours);
      const starsPerHour = parseInt(repo.clickhouse.starsWithin) / hoursSinceFirstSeen;

      // Reward repos with senior stargazers
      // Also, penalize repos with fake stars (fresh users)
      const stargazersAge = repo.stargazers.nodes.map(u => Math.round(daysSince(u.createdAt)));
      const medianStargazersAge = median(stargazersAge)!;

      // Adjust for eval date if set (historical scans)
      const evalDate = process.env.SCAN_EVAL_DATE;
      const daysSinceEval = evalDate ? daysSince(evalDate) : 0;

      const score = starsPerHour * ((medianStargazersAge - daysSinceEval) / 365);
      return { ...repo, score };
    })
    .sort((a, b) => b.score - a.score);

  const top5Missed = ranked.slice(topN, topN + 5).map(repo => repo.nameWithOwner);
  if (top5Missed.length > 0) {
    logInfo('score', `missed the cut: ${top5Missed.join(', ')}`);
  }

  return ranked.slice(0, topN);
}
