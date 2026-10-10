import { expect, test } from 'vitest';
import { refKind, sourceArchiveRef } from '../../src/utils/historyRefs';

test('refKind separates source branches from evidence, notes and archived source', () => {
	expect(refKind('refs/heads/main')).toBe('source');
	expect(refKind('refs/heads/feature/harness-evidence-ui')).toBe('source');
	expect(refKind('refs/heads/harness-evidence')).toBe('evidence');
	expect(refKind('refs/notes/harness')).toBe('notes');
	expect(refKind(sourceArchiveRef('a'.repeat(40)))).toBe('archive');
	expect(refKind('refs/harness/remotes/origin/evidence')).toBe('internal');
	expect(refKind('refs/tags/v1.0.0')).toBe('tag');
	expect(refKind('refs/remotes/origin/main')).toBe('remote');
});

test('sourceArchiveRef names the commit it keeps', () => {
	expect(sourceArchiveRef('a'.repeat(40))).toBe(`refs/harness/source/${'a'.repeat(40)}`);
});
