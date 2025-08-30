import { weekNumber } from '../utils/common';
import { ScoredRepo } from '../pipeline/rank';

export abstract class Publisher {
  abstract readonly name: string;
  abstract enabled(): boolean;
  render?(repos: ScoredRepo[]): string;
  abstract publish(repos: ScoredRepo[]): Promise<string>;

  subject(): string {
    const now = new Date();
    const year = now.getFullYear();
    const week = weekNumber(now);
    return `GitHub Trends - ${year}-W${week.toString().padStart(2, '0')}`;
  }
}
