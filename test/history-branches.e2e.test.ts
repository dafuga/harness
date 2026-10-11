import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { build, type Built } from './support/historyIndexFixture';
import { freshClone, harnessJson, removeRemote, withRemote } from './support/historyRepo';
import { baselineRepo, type VerifyRepo } from './support/verifyRepo';

/**
 * A normal clone has one local branch; every other branch of its remote is a remote-tracking
 * ref. The history built there must still hold all of them, with their commits, under the names
 * they have where they came from, and must never give a remote tip the name of a local branch
 * that points somewhere else.
 */
let repo: VerifyRepo;
let reader: VerifyRepo;
let remote: string;
let original: Built;
const tips: Record<string, string> = {};
const offline = () => ({
	PROJECT_REPORTS_HOME: join(reader.root, 'no-such-store'),
	HARNESS_ANALYTICS_DISABLED: '1'
});
const names = (built: Built) => built.index.branches.map((branch) => branch.name);
const head = (built: Built, name: string) =>
	built.index.branches.find((branch) => branch.name === name)?.head;

beforeAll(async () => {
	repo = await baselineRepo();
	tips.main = await repo.git(['rev-parse', 'HEAD']);
	// Three more branches of code; one name has a slash and a character a path must encode.
	for (const branch of ['feature/kept#1', 'release/1.0', 'topic']) {
		await repo.git(['checkout', '-q', '-b', branch, 'main']);
		await repo.write(`notes/${branch.replace(/\W+/g, '-')}.md`, `Work on ${branch}.\n`);
		tips[branch] = await repo.commit(`docs: work on ${branch}`);
	}
	await repo.git(['checkout', '-q', 'main']);
	remote = await withRemote(repo);
	await repo.git(['push', '-q', 'origin', '--all']);
	await harnessJson(repo, ['history', 'push', 'origin']);
	original = await build(repo, join(repo.root, '.cache/history-origin'));
	reader = await freshClone(remote);
	await harnessJson(reader, ['history', 'fetch', 'origin'], offline());
}, 300_000);
afterAll(async () => {
	await Promise.all([repo?.dispose(), reader?.dispose(), removeRemote(remote)]);
});

test('a fresh clone holds every branch of its remote with all their commits, under the same names', async () => {
	// The clone has the checked-out branch as its only local branch of code.
	const local = await reader.git(['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
	expect(local.split('\n').filter((name) => name !== 'harness-evidence')).toEqual(['main']);
	const rebuilt = await build(reader, join(reader.root, '.cache/history'), offline());
	expect(names(original)).toEqual(['feature/kept#1', 'main', 'release/1.0', 'topic']);
	expect(rebuilt.index.branches).toEqual(original.index.branches);
	expect(rebuilt.index.branches.map((branch) => branch.head)).toEqual(
		names(original).map((name) => tips[name])
	);
	const commits = (built: Built) => built.index.revisions.map((revision) => revision.commit);
	expect(commits(rebuilt)).toEqual(commits(original));
	expect(commits(rebuilt)).toEqual(expect.arrayContaining(Object.values(tips)));
	// Nothing about the history differs from the one it was pushed from.
	expect([rebuilt.problems, rebuilt.digest]).toEqual([[], original.digest]);
}, 300_000);

test('a local branch behind its remote stays where it is, and the remote tip is listed beside it', async () => {
	// A stale local branch, and a local branch whose name looks like a remote one.
	await reader.git(['branch', 'topic', tips.main]);
	await reader.git(['branch', 'origin/topic', tips['release/1.0']]);
	const rebuilt = await build(reader, join(reader.root, '.cache/history-stale'), offline());
	expect(names(rebuilt)).toEqual([
		'feature/kept#1',
		'main',
		'origin/topic',
		'origin:topic',
		'release/1.0',
		'topic'
	]);
	expect([
		head(rebuilt, 'topic'),
		head(rebuilt, 'origin:topic'),
		head(rebuilt, 'origin/topic')
	]).toEqual([tips.main, tips.topic, tips['release/1.0']]);
	const reached = rebuilt.index.revisions.find((revision) => revision.commit === tips.topic) as
		| { branches?: string[] }
		| undefined;
	expect(reached?.branches).toEqual(['origin:topic']);
	await reader.git(['branch', '-D', 'topic', 'origin/topic']);
}, 300_000);
