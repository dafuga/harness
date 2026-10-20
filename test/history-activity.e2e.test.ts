import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { consoleAccess, type ConsoleData } from '../src/lib/console';
import { consoleDataModules } from '../src/services/console-install-service/consoleDataModules';
import { indexFiles } from '../src/utils/indexFiles';
import { build, indexedRepo, type IndexedCommits } from './support/historyIndexFixture';
import { sha256 } from './support/historyRepo';
import type { VerifyRepo } from './support/verifyRepo';

/**
 * The history index carries what the project did, built from Git alone, so a console installed
 * in a host shows it without Git or a database. It is a record: it holds no live state, it is
 * the same bytes whenever it is built, and it leaves the server only behind the host policy.
 */
interface Recorded {
	kind: string;
	repository: { name: string; branch: string | null; head: string | null };
	asOf: { commit: string; committedAt: string } | null;
	loops: { total: number; types: unknown[] };
	work: Array<{
		commit: string;
		subject: string;
		units: string[];
		reasons: Array<{ unit: string; behavior: string }>;
	}>;
	files: Array<{ path: string; status: string; commit: string; units: string[] }>;
}
let repo: VerifyRepo;
let commits: IndexedCommits;
let out: string;
const stored = async () =>
	JSON.parse(await readFile(join(out, 'activity.json'), 'utf8')) as Recorded;

beforeAll(async () => {
	({ repo, commits } = await indexedRepo());
	out = join(repo.root, '.cache/history-activity');
	await build(repo, out);
}, 300_000);
afterAll(() => repo.dispose());

test('a built history records the work, files and components of the repository, from Git alone', async () => {
	const recorded = await stored();
	expect([recorded.kind, recorded.asOf?.commit, recorded.repository.head]).toEqual([
		'recorded',
		commits.unverified,
		commits.unverified
	]);
	expect(recorded.work[0]).toMatchObject({ commit: commits.unverified, units: [], reasons: [] });
	const changed = recorded.work.find((item) => item.commit === commits.changed);
	expect(changed?.units).toContain('function.slugify');
	expect(changed?.reasons).toEqual([{ unit: 'function.slugify', behavior: 'Fixture change.' }]);
	expect(recorded.files.find((item) => item.path === 'src/utils/slugify.ts')).toMatchObject({
		status: 'modified',
		commit: commits.changed,
		units: ['function.slugify']
	});
	// A record of history holds no machine state: no checkout, no agent, no time of building.
	const text = await readFile(join(out, 'activity.json'), 'utf8');
	expect(text).not.toMatch(/worktrees|agents|sampledAt|generatedAt/);
	expect(text).not.toContain(repo.root);
});

test('building again gives the same bytes', async () => {
	const before = sha256(await readFile(join(out, 'activity.json')));
	const again = join(repo.root, '.cache/history-activity-again');
	await build(repo, again);
	expect(sha256(await readFile(join(again, 'activity.json')))).toBe(before);
});

test('the recorded activity leaves a host only behind its policy, and is bundled by an install', async () => {
	const data: ConsoleData = {
		json: async (path) => readFile(join(out, path), 'utf8').catch(() => undefined),
		media: async () => undefined
	};
	const event = (admin: boolean) => ({
		request: new Request('https://host.example/harness/data/activity.json'),
		url: new URL('https://host.example/harness/data/activity.json'),
		locals: { admin }
	});
	const access = consoleAccess({
		policy: (asked) => (asked.locals as { admin?: boolean }).admin === true,
		data
	});
	const refused = await access.json(event(false), 'activity.json');
	expect([refused.status, await refused.text()]).toEqual([403, 'Forbidden']);
	const answered = await access.json(event(true), 'activity.json');
	expect([answered.status, answered.headers.get('cache-control')]).toEqual([200, 'no-store']);
	expect(((await answered.json()) as Recorded).kind).toBe('recorded');
	const modules = consoleDataModules(await indexFiles(out));
	expect(modules.map((file) => file.path).filter((path) => path.includes('activity'))).toEqual([
		'src/lib/server/harness/data/activity.json.ts'
	]);
});
