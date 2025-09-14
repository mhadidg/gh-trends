import { HttpError, logInfo } from '../utils/logging';

export interface ClickHouseResponse {
  data: ClickHouseRepo[];
  statistics: { rows_read: number };
}

export interface ClickHouseRepo {
  repoName: string; // e.g, "owner/repo"
  starsBefore: string; // stars count before the scan window
  starsWithin: string; // stars count within the scan window
  firstSeenAt: string; // e.g, 2025-07-20 00:48:54
}

export class ClickHouseClient {
  static readonly baseUrl = 'https://sql-clickhouse.clickhouse.com';

  async getTrendingRepos(windowInDays: number, limit: number): Promise<ClickHouseRepo[]> {
    // Enables querying historical windows, where now is eval date
    const evalDateStr = process.env.SCAN_EVAL_DATE || new Date().toISOString();
    const evalDate = new Date(evalDateStr);

    const sql = this.trendingReposQuery(evalDate, windowInDays, limit);
    const result = await this.query(sql);
    return result.data;
  }

  private async query(sql: string): Promise<ClickHouseResponse> {
    const response = await fetch(ClickHouseClient.baseUrl, {
      method: 'POST',
      body: sql,
      headers: {
        'X-ClickHouse-User': 'demo',
        'X-ClickHouse-Key': '',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new HttpError('clickhouse', 'query execution failed', response);
    }

    const json = await response.json();
    const rowsRead = json.statistics.rows_read.toLocaleString();
    logInfo('clickhouse', `number of rows inspected: ${rowsRead}`);

    return {
      data: json.data,
      statistics: json.statistics,
    };
  }

  private trendingReposQuery(evalDate: Date, window: number, limit: number): string {
    // ClickHouse expects 2000-01-01 00:00:00 format; ISO is 2000-01-01T00:00:00.000Z
    const evalDateStr = evalDate.toISOString().slice(0, 19).replace('T', ' ');

    // Minimum repo star growth rate within the interval window for inclusion
    const growthRate = parseFloat(process.env.SCAN_MIN_GROWTH_RATE!);

    return `
      WITH
          '${evalDateStr}'::timestamp AS END_DATE,
          END_DATE - INTERVAL ${window} DAY AS START_DATE,
          ${limit} AS LIMIT_N,
          ${growthRate} AS MIN_GROWTH_RATE
      SELECT
          repo_name as repoName,
          countIf(event_type = 'WatchEvent' AND created_at < START_DATE) AS starsBefore,
          countIf(event_type = 'WatchEvent' AND created_at >= START_DATE) AS starsWithin,
          minIf(created_at, event_type = 'WatchEvent') AS firstSeenAt
      FROM github.events
      WHERE event_type = 'WatchEvent' AND created_at <= END_DATE
      GROUP BY repoName
      HAVING starsWithin / starsBefore > MIN_GROWTH_RATE
      ORDER BY starsWithin DESC
      LIMIT LIMIT_N
      FORMAT JSON
    `;
  }
}
