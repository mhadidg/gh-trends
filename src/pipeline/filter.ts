import { daysSince } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';
import { logInfo, logWarn } from '../utils/logging';

export interface ScoredRepo extends GithubRepo {
  score: number;
}

export function filter(repos: GithubRepo[]): GithubRepo[] {
  const minStars = parseInt(process.env.FILTER_MIN_STARS!);

  // Sometimes renamed filter catches non-renamed repos due to aggressive
  // sampling from Clickhouse - or Github?; During those periods, we allow
  // renamed repos. Ideally, this should always be enabled
  const filterRenamed = process.env.FILTER_RENAMED === 'true';

  return repos.filter(repo => {
    const repoName = repo.nameWithOwner;

    // Apply minimum stars filter
    if (repo.stargazerCount < minStars) {
      logInfo('filter', `too few stars, skipping: ${repoName}`);
      return false;
    }

    // Catch renamed repos based on star gap between Clickhouse and Github
    // Only applicable when eval date is unset/today
    const evalDate = process.env.SCAN_EVAL_DATE;
    if (!evalDate && filterRenamed) {
      const clickhouseTotalStars =
        parseInt(repo.clickhouse.starsBefore) + parseInt(repo.clickhouse.starsWithin);

      // NOTE: Clickhouse samples events, so the actual star count (as per
      // Github) is likely 2x the reported from Clickhouse. However, if the
      // ratio is >5x, it's almost certainly a renamed repo.
      const starGapFactor = Math.round(repo.stargazerCount / clickhouseTotalStars);
      if (starGapFactor > 5) {
        logWarn('filter', `renamed old repo (x${starGapFactor} gap), skipping: ${repoName}`);
        return false;
      }
    }

    if (process.env.FILTER_EMPTY_DESC === 'true') {
      if (repo.description === null || repo.description.trim() === '') {
        logWarn('filter', `empty description, skipping: ${repoName}`);
        return false;
      }
    }

    // Filter out CJK repos (Chinese, Japanese, Korean)
    // Detect English only is hard (esp. for short descriptions)
    if (repo.description) {
      const desc = repo.description.trim();

      if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(desc)) {
        logWarn('filter', `CJK script in description, skipping: ${repoName}`);
        return false;
      }
    }

    // Catch malware repos (mostly crypto wallet drainers)
    // Adjust for eval date if set (historical scans)
    const daysSinceEval = evalDate ? daysSince(evalDate) : 0;
    if (repo.owner.__typename === 'User' && daysSince(repo.owner.createdAt) - daysSinceEval < 30) {
      logWarn('filter', `malware repo (fresh owner), skipping: ${repoName}`);
      return false;
    }

    return true;
  });
}
