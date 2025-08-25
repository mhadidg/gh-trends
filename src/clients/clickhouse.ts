import { HttpError, logInfo } from '../utils/logging';

export interface ClickHouseResponse {
  data: ClickHouseRepo[];
  statistics: { rows_read: number };
}

export interface ClickHouseRepo {
  repo_name: string;
  appeared_at: string;
}

export class ClickHouseClient {
  static readonly baseUrl = 'https://play.clickhouse.com/?user=play';

  async getTrendingRepos(days: number, limit: number): Promise<ClickHouseRepo[]> {
    const sql = this.trendingReposQuery(days, limit);
    const result = await this.query(sql);
    return result.data;
  }

  private async query(sql: string): Promise<ClickHouseResponse> {
    const response = await fetch(ClickHouseClient.baseUrl, {
      method: 'POST',
      body: sql,
    });

    if (!response.ok) {
      throw new HttpError('clickhouse', 'query execution failed', response);
    }

    const json = await response.json();
    logInfo('clickhouse', `number of rows inspected: ${json.statistics.rows_read}`);

    return {
      data: json.data,
      statistics: json.statistics,
    };
  }

  private trendingReposQuery(days: number, limit: number): string {
    return `
      WITH
          now() AS t_now,
          t_now - INTERVAL ${days} DAY AS cutoff,
          ${limit} AS LIMIT_N
      SELECT
          repo_name,
          countIf(event_type = 'WatchEvent') AS stars,
          greatest(
              maxIf(created_at, event_type = 'PublicEvent'), /* repo made public, was private */
              maxIf(created_at, event_type = 'CreateEvent' AND ref_type = 'repository')
          ) AS appeared_at
      FROM github_events
      WHERE created_at >= cutoff
      GROUP BY repo_name
      HAVING appeared_at >= cutoff
      ORDER BY stars DESC, appeared_at DESC
      LIMIT LIMIT_N
      FORMAT JSON
    `;
  }
}
