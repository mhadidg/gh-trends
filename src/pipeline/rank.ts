import { clamp, daysSince, hoursSince } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';
import { logWarn } from '../utils/logging';

const BLOCKLIST_KEYWORDS = [/aimbot/i, /kms/i];
const BLOCKLIST_USERS = ['ox1nec', '0xalberto', 'kinexbt'];

const BLOCKLIST_REPOS = [
  'JimmyLv/awesome-nano-banana', // duplicate
  'PicoTrex/Awesome-Nano-Banana-images', // duplicate
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

      // Only applicable when eval date is unset/today
      if (!process.env.SCAN_EVAL_DATE) {
        const clickhouseTotalStars =
          parseInt(repo.clickhouse.starsBefore) + parseInt(repo.clickhouse.starsWithin);

        // NOTE: Clickhouse samples events, so the actual star count (as per
        // Github) is likely 2x the reported from Clickhouse. However, if the
        // ratio is >3x, it's almost certainly a renamed repo.
        if (Math.round(repo.stargazerCount / clickhouseTotalStars) > 3) {
          logWarn('score', `presumably renamed old repo, skipping: ${repoName}`);
          return false;
        }
      }

      if (process.env.RELEASE_EMPTY_DESC === 'false') {
        if (repo.description === null || repo.description.trim() === '') {
          logWarn('score', `presumably low quality (empty desc), skipping: ${repoName}`);
          return false;
        }
      }

      if (repo.description) {
        const desc = repo.description.trim();

        if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(desc)) {
          logWarn('score', `CJK script in description, skipping: ${repoName}`);
          return false;
        }
      }

      // Catch malware repos (mostly crypto wallet drainers)
      if (daysSince(repo.owner.createdAt) < 30 && repo.owner.__typename === 'User') {
        logWarn('score', `presumably malware (fresh owner), skipping: ${repoName}`);
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
      return { ...repo, score: parseInt(repo.clickhouse.starsWithin) / hoursSinceFirstSeen };
    })
    .sort((a, b) => b.score - a.score);

  for (const repo of ranked.slice(limit, limit + 10)) {
    logWarn('score', `missed the cut: ${repo.nameWithOwner} (score: ${repo.score.toFixed(2)})`);
  }

  return ranked.slice(0, limit);
}
