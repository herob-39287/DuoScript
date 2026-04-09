import { describe, expect, it } from 'vitest';
import { detectCodexArtifact } from './import';

describe('codex markdown question detection', () => {
  it('accepts markdown only when codex_questions header and Q: markers are present', () => {
    const artifact = detectCodexArtifact(
      {},
      '# codex_questions\n- Q: What route should branch first?',
    );
    expect(artifact.type).toBe('questions');
    if (artifact.type === 'questions') {
      expect(artifact.questions.questions).toEqual(['What route should branch first?']);
    }
  });

  it('does not misclassify ordinary summary markdown as questions', () => {
    expect(() =>
      detectCodexArtifact(
        {},
        '# Summary\n- Updated chapter pacing\n- Validator issues reduced from 6 to 2',
      ),
    ).toThrow('Unsupported Codex artifact format.');
  });

  it('does not accept codex_questions markdown when Q: lines are missing', () => {
    expect(() =>
      detectCodexArtifact(
        {},
        '# codex_questions\n- Updated chapter pacing\n- Validator issues reduced from 6 to 2',
      ),
    ).toThrow('Unsupported Codex artifact format.');
  });
});
