import { readFileSync } from 'fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import { ScoredRepo } from './rank';

Handlebars.registerHelper('formatNumber', (num: number) => num.toLocaleString());
Handlebars.registerHelper('truncate', (str: string, len: number) => {
  if (len <= 0) return str;
  if (str.length <= len) return str;
  if (str[len - 1] === ' ') len -= 1; // trailing space
  return str.slice(0, len) + '…';
});

export function render(templateName: string, repos: ScoredRepo[]): string {
  // Read template file from src; only *.ts files are compiled to dist/
  const absolutePath = path.join(process.cwd(), 'src', 'templates', templateName);
  const templateSource = readFileSync(absolutePath, 'utf-8');
  const template = Handlebars.compile(templateSource);

  const now = new Date();
  const date = now.toISOString().split('T')[0];

  const descLimit = parseInt(process.env.RELEASE_TRUNCATE_DESC || '0');
  return template({ repos, date, descLimit });
}
