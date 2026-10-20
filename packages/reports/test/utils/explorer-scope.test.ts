import { expect, test } from 'vitest';
import { explorerScope } from '../../src/utils/harness-page/explorerScope';
import { history, sha, summary } from '../explorerFixture';

const index = history({
	branches: [
		{ name: 'main', head: sha('c') },
		{ name: 'feature/x', head: sha('d') },
		{ name: 'gone', head: sha('9') }
	],
	revisions: [
		summary(sha('d'), { parents: [sha('b')], branches: ['feature/x'] }),
		summary(sha('c'), { parents: [sha('b'), sha('d')], branches: ['main'] }),
		summary(sha('b'), { parents: [sha('a')], branches: ['main', 'feature/x'] }),
		summary(sha('a'), { parents: [], branches: ['main', 'feature/x'] }),
		summary(sha('e'), { parents: [sha('a')], branches: [], retained: true })
	]
});
const scope = (branch: string | null, commit: string | null) => {
	const found = explorerScope(index, { branch, commit, category: 'pages' });
	return found.kind === 'scope' ? found.scope : found.message;
};

test('a branch address shows the head the index records for that branch', () => {
	expect(scope('main', null)).toMatchObject({
		mode: 'current',
		branch: 'main',
		tip: sha('c'),
		commit: sha('c'),
		atTip: true,
		parent: sha('b')
	});
	expect(scope('feature/x', null)).toMatchObject({ tip: sha('d'), commit: sha('d') });
});

test('a selected commit stays selected, with the tip of its branch beside it', () => {
	expect(scope('main', sha('b'))).toMatchObject({
		mode: 'commit',
		tip: sha('c'),
		commit: sha('b'),
		atTip: false,
		parent: sha('a')
	});
	// Selecting the tip itself is still a selected commit: it does not follow the branch.
	expect(scope('main', sha('c'))).toMatchObject({ mode: 'commit', atTip: true });
});

test('the parent is the first parent, and a first commit has none', () => {
	expect(scope('main', sha('c'))).toMatchObject({ parent: sha('b') });
	expect(scope('main', sha('a'))).toMatchObject({ parent: null });
});

test('a commit that no branch reaches has no branch and no tip', () => {
	expect(scope(null, sha('e'))).toMatchObject({
		mode: 'commit',
		branch: null,
		tip: null,
		commit: sha('e'),
		atTip: false
	});
});

test('what the history does not hold is said, and nothing else is shown instead', () => {
	expect(scope('nowhere', null)).toBe('Branch nowhere is not in this history.');
	expect(scope('gone', null)).toBe('The tip of branch gone (9999999) is not in this history.');
	expect(scope('main', sha('f'))).toBe('Commit fffffff is not in this history.');
	expect(scope('main', sha('d'))).toBe('Branch main does not contain commit ddddddd.');
	expect(scope(null, sha('f'))).toBe('Commit fffffff is not in this history.');
});
