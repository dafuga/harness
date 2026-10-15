import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { GitAdapter } from '../src/adapters/GitAdapter';
import { SourceHistoryRepository } from '../src/repositories/SourceHistoryRepository';

/**
 * A source history read walks each distinct head Git lists once, however many branches name it,
 * and still names every branch that reaches a commit, in branch order. The next read walks the
 * heads again, so a branch that moved is seen, and a head Git cannot walk fails as before.
 */
const roots: string[] = [];
afterEach(() => {
	vi.restoreAllMocks();
	roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
function repository() {
	const root = mkdtempSync(join(tmpdir(), 'harness-source-heads-'));
	roots.push(root);
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
	git('init', '-q', '-b', 'main');
	git('config', 'user.name', 'Fixture');
	git('config', 'user.email', 'fixture@example.invalid');
	git('commit', '-q', '--allow-empty', '-m', 'first');
	const c1 = git('rev-parse', 'HEAD');
	git('commit', '-q', '--allow-empty', '-m', 'second');
	const c2 = git('rev-parse', 'HEAD');
	git('branch', 'a', c1);
	git('branch', 'b', c2);
	git('branch', 'c', c1);
	return { root, git, c1, c2 };
}
/** The rev-list walks of the reads made while `read` runs, by the head each walked. */
async function walked<T>(read: () => Promise<T>) {
	const run = vi.spyOn(GitAdapter.prototype, 'run');
	try {
		const result = await read().catch((error: Error) => error);
		const walks = run.mock.calls
			.filter(([args]) => args[0] === 'rev-list')
			.map(([args]) => args[1]);
		return { result, walks };
	} finally {
		run.mockRestore();
	}
}
const reached = (history: Awaited<ReturnType<SourceHistoryRepository['read']>>) =>
	history.revisions.map((revision) => [revision.commit, revision.branches, revision.retained]);

test('a read walks each distinct head once and names every branch reaching a commit, in order', async () => {
	const { root, c1, c2 } = repository();
	const { result, walks } = await walked(() => new SourceHistoryRepository(root).read(10));
	if (result instanceof Error) throw result;
	expect(result.branches).toEqual([
		{ name: 'a', head: c1 },
		{ name: 'b', head: c2 },
		{ name: 'c', head: c1 },
		{ name: 'main', head: c2 }
	]);
	expect(reached(result)).toEqual([
		[c2, ['b', 'main'], false],
		[c1, ['a', 'b', 'c', 'main'], false]
	]);
	expect(walks).toEqual([c1, c2]);
});

test('the next read walks the heads again and sees a branch that moved and a new commit', async () => {
	const { root, git, c1, c2 } = repository();
	const history = new SourceHistoryRepository(root);
	await history.read(10);
	git('branch', '-f', 'a', c2);
	git('commit', '-q', '--allow-empty', '-m', 'third');
	const c3 = git('rev-parse', 'HEAD');
	const { result, walks } = await walked(() => history.read(10));
	if (result instanceof Error) throw result;
	expect(reached(result)).toEqual([
		[c3, ['main'], false],
		[c2, ['a', 'b', 'main'], false],
		[c1, ['a', 'b', 'c', 'main'], false]
	]);
	expect(walks).toEqual([c2, c1, c3]);
});

test('a head Git cannot walk fails the read as before, after each head before it was walked once', async () => {
	const { root, git, c1, c2 } = repository();
	// An orphan branch whose head is intact and whose parent is gone: Git lists it and cannot walk it.
	git('checkout', '-q', '--orphan', 'z');
	git('commit', '-q', '--allow-empty', '-m', 'lost parent');
	const lost = git('rev-parse', 'HEAD');
	git('commit', '-q', '--allow-empty', '-m', 'orphan head');
	const orphan = git('rev-parse', 'HEAD');
	git('checkout', '-q', 'main');
	rmSync(join(root, '.git', 'objects', lost.slice(0, 2), lost.slice(2)));
	const { result, walks } = await walked(() => new SourceHistoryRepository(root).read(10));
	expect(result).toBeInstanceOf(Error);
	expect((result as Error).message).toMatch(new RegExp(`^git rev-list ${orphan} failed: `));
	expect(walks).toEqual([c1, c2, orphan]);
});
