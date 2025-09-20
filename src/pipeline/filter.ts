import { daysSince } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';
import { logWarn } from '../utils/logging';

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

export function filter(repos: GithubRepo[]): GithubRepo[] {
  const minStars = parseInt(process.env.RELEASE_MIN_STARS!);

  return repos.filter(repo => {
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
        logWarn('filter', `renamed old repo (x${starGapFactor} gap), skipping: ${repoName}`);
        return false;
      }
    }

    if (process.env.RELEASE_EMPTY_DESC === 'false') {
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

    // Catch blocklisted keywords
    for (const pattern of BLOCKLIST_KEYWORDS) {
      if (pattern.test(repoName) || (repo.description && pattern.test(repo.description))) {
        logWarn('filter', `blocklisted keyword in repo name, skipping: ${repoName}`);
        return false;
      }
    }

    // Catch blocklisted users
    if (BLOCKLIST_USERS.includes(repoName.split('/')[0]!)) {
      logWarn('filter', `blocklisted user, skipping: ${repoName}`);
      return false;
    }

    // Catch blocklisted repos
    if (BLOCKLIST_REPOS.includes(repoName)) {
      logWarn('filter', `blocklisted repo, skipping: ${repoName}`);
      return false;
    }

    return true;
  });
}
