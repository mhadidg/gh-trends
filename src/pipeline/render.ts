import { readFileSync } from 'fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import { ScoredRepo } from './rank';

Handlebars.registerHelper('formatNumber', (num: number) => num.toLocaleString());
Handlebars.registerHelper('truncate', (str: string, len: number) => {
  if (str.length <= len) return str;
  if (str[len - 1] === ' ') len -= 1; // trailing space
  return str.slice(0, len) + '…';
});

// TODO: fix HTML entities are not decoded (e.g., &amp;)
export function render(templateName: string, repos: ScoredRepo[]): string {
  // Read template file from src; not compiled in dist/
  const absolutePath = path.join(process.cwd(), 'src', 'templates', templateName);
  const templateSource = readFileSync(absolutePath, 'utf-8');
  const template = Handlebars.compile(templateSource);

  const now = new Date();
  const date = now.toISOString().split('T')[0];

  return template({ repos, date });
}
