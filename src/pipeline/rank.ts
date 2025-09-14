import { clamp, daysSince, hoursSince, median } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';
import { logInfo, logWarn } from '../utils/logging';

const BLOCKLIST_KEYWORDS = [/aimbot/i, /kms/i];
const BLOCKLIST_USERS = ['ox1nec', '0xalberto', 'kinexbt'];

const BLOCKLIST_REPOS = [
  'JimmyLv/awesome-nano-banana', // duplicate
  'PicoTrex/Awesome-Nano-Banana-images', // duplicate
  'byJoey/cfnew', // Chinese
];

export interface ScoredRepo extends GithubRepo {
  score: number;
}

export function rank(repos: GithubRepo[]): ScoredRepo[] {
  const minStars = parseInt(process.env.RELEASE_MIN_STARS!);
  const limit = parseInt(process.env.RELEASE_TOP_N!);

  const ranked = repos
    .filter(repo => {
      const repoName = repo.nameWithOwner;

      // Apply minimum stars filter
      if (repo.stargazerCount < minStars) {
        return false;
      }

      // Catch renamed repos
      // Only applicable when eval date is unset/today
      const evalDate = process.env.SCAN_EVAL_DATE;
      if (!evalDate) {
        const clickhouseTotalStars =
          parseInt(repo.clickhouse.starsBefore) + parseInt(repo.clickhouse.starsWithin);

        // NOTE: Clickhouse samples events, so the actual star count (as per
        // Github) is likely 2x the reported from Clickhouse. However, if the
        // ratio is >5x, it's almost certainly a renamed repo.
        const starGapFactor = Math.round(repo.stargazerCount / clickhouseTotalStars);
        if (starGapFactor > 5) {
          logWarn('score', `renamed old repo (x${starGapFactor} gap), skipping: ${repoName}`);
          return false;
        }
      }

      if (process.env.RELEASE_EMPTY_DESC === 'false') {
        if (repo.description === null || repo.description.trim() === '') {
          logWarn('score', `empty description, skipping: ${repoName}`);
          return false;
        }
      }

      // Filter out CJK repos (Chinese, Japanese, Korean)
      // Detect English only is hard (esp. for short descriptions)
      if (repo.description) {
        const desc = repo.description.trim();

        if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(desc)) {
          logWarn('score', `CJK script in description, skipping: ${repoName}`);
          return false;
        }
      }

      // Catch malware repos (mostly crypto wallet drainers)
      // Adjust for eval date if set (historical scans)
      const daysSinceEval = evalDate ? daysSince(evalDate) : 0;
      if (
        repo.owner.__typename === 'User' &&
        daysSince(repo.owner.createdAt) - daysSinceEval < 30
      ) {
        logWarn('score', `malware repo (fresh owner), skipping: ${repoName}`);
        return false;
      }

      // Catch blocklisted keywords
      for (const pattern of BLOCKLIST_KEYWORDS) {
        if (pattern.test(repoName) || (repo.description && pattern.test(repo.description))) {
          logWarn('score', `blocklisted keyword in repo name, skipping: ${repoName}`);
          return false;
        }
      }

      // Catch blocklisted users
      if (BLOCKLIST_USERS.includes(repoName.split('/')[0]!)) {
        logWarn('score', `blocklisted user, skipping: ${repoName}`);
        return false;
      }

      // Catch blocklisted repos
      if (BLOCKLIST_REPOS.includes(repoName)) {
        logWarn('score', `blocklisted repo, skipping: ${repoName}`);
        return false;
      }

      return true;
    })
    .map(function (repo) {
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

  const top5Missed = ranked.slice(limit, limit + 5).map(repo => repo.nameWithOwner);
  if (top5Missed.length > 0) {
    logInfo('score', `missed the cut: ${top5Missed.join(', ')}`);
  }

  return ranked.slice(0, limit);
}
