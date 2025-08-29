import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../../src/pipeline/render';
import { mockRepos } from '../../src/mocks/repos';
import { ScoredRepo } from '../../src/pipeline/rank';

describe('render.ts', () => {
  const template = 'markdown.hbs';
  const mockDate = new Date('2025-08-15T10:00:00.000Z'); // friday, Week 33

  const mockScoredRepos: ScoredRepo[] = mockRepos.map((repo, index) => ({
    ...repo, // spread the original props
    score: 0.9 - index * 0.1,
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('markdown', () => {
    it('should handle empty repos array', () => {
      const content = render(template, []);

      expect(content).toContain('quiet week on GitHub');
    });

    it('should render release with single repo', () => {
      const content = render(template, [mockScoredRepos[0]!]);

      expect(content).toContain(mockScoredRepos[0]!.nameWithOwner);
    });

    it('should render release with multiple repos', () => {
      const content = render(template, [mockScoredRepos[0]!, mockScoredRepos[1]!]);

      expect(content).toContain(mockScoredRepos[0]!.nameWithOwner);
      expect(content).toContain(mockScoredRepos[1]!.nameWithOwner);
    });

    it('should include key information', () => {
      const content = render(template, [mockScoredRepos[0]!]);

      expect(content).toContain(mockScoredRepos[0]!.nameWithOwner);
      expect(content).toContain(mockScoredRepos[0]!.description);
      expect(content).toContain(mockScoredRepos[0]!.url);
      expect(content).toContain(mockScoredRepos[0]!.stargazerCount.toLocaleString());
    });

    it('should handle repos with null optionals', () => {
      const content = render(template, [
        {
          ...mockScoredRepos[0]!,
          description: null,
          primaryLanguage: null,
        },
      ]);

      expect(content).toContain('(no description)');
    });

    it('should handle special chars in descriptions', () => {
      const specialCharRepo: ScoredRepo = {
        ...mockScoredRepos[0]!,
        description: 'Tool with "quotes" and <tags> & special chars',
      };

      const content = render(template, [specialCharRepo]);

      expect(content).toBeTruthy(); // should not break rendering
    });

    it('should handle unicode chars in descriptions', () => {
      const unicodeRepo: ScoredRepo = {
        ...mockScoredRepos[0]!,
        description: 'A project with emojis 🚀 and unicode chars 你好',
      };

      const content = render(template, [unicodeRepo]);

      expect(content).toContain('🚀');
      expect(content).toContain('你好');
    });
  });
});
