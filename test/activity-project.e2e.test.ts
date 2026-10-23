import type { Shown } from './activity-project.e2e.test.types';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { slugifySource, titleServiceSource, unitProject } from './support/unitProject';
import { repoAt, type VerifyRepo } from './support/verifyRepo';
let repo: VerifyRepo;
let foreign: VerifyRepo;
let side: string;
let commits: { first: string; second: string };
const shown = async (target: VerifyRepo, more: string[] = []) =>
	target.harnessJson<Shown>(['activity', 'show', ...more]);

async function project(): Promise<VerifyRepo> {
	const made = repoAt((await unitProject('lib')).root);
	await made.write('src/utils/slugify.ts', slugifySource);
	await made.write('src/services/TitleService.ts', titleServiceSource);
	await made.harness(['units', 'index', '--write']);
	await made.git(['init', '-q', '-b', 'main']);
	return made;
}

beforeAll(async () => {
	repo = await project();
	const first = await repo.commit('feat: titles');
	const loop = (name: string, from: string) =>
		repo.harness(['loop', 'create', name, '--from', from, '--goal', `Goal of ${name}`]);
	await loop('ship-titles', 'feature');
	for (const step of ['spec', 'implement', 'test', 'verify']) {
		await repo.harness(['loop', 'complete', 'ship-titles', step, '--evidence', 'Done.']);
	}
	await loop('fix-case', 'bug-fix');
	await loop('more-titles', 'feature');
	const second = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	await repo.harness(['history', 'reasons']);
	commits = { first, second };
	// A second checkout with work that is not committed, and a file nobody tracks.
	side = join(await mkdtemp(join(tmpdir(), 'harness-activity-side-')), 'side');
	await repo.git(['worktree', 'add', '-q', '-b', 'side', side]);
	await writeFile(join(side, 'src/services/TitleService.ts'), `${titleServiceSource}// draft\n`);
	await writeFile(join(side, 'notes.txt'), 'draft\n');
	await repo.write('src/utils/extra.ts', 'export const extra = 1;\n');
	foreign = await project();
	await foreign.commit('feat: foreign storefront');
}, 240_000);
afterAll(async () => {
	await rm(join(side, '..'), { recursive: true, force: true });
	await repo.dispose();
	await foreign.dispose();
});

test('it names the repository and how often each loop type was used and finished', async () => {
	const { activity } = await shown(repo);
	expect([activity.kind, activity.repository]).toEqual([
		'live',
		{ name: 'demo', branch: 'main', head: commits.second }
	]);
	expect(activity.loops.total).toBe(3);
	expect(activity.loops.types).toEqual([
		expect.objectContaining({ template: 'feature', loops: 2, complete: 1, open: 1 }),
		expect.objectContaining({ template: 'bug-fix', loops: 1, complete: 0, open: 1 })
	]);
	expect(activity.loops.types[0].names.sort()).toEqual(['more-titles', 'ship-titles']);
});

test('recent work is the commits, newest first, with their branch, components and noted reasons', async () => {
	const { activity } = await shown(repo);
	expect(activity.work.map((item) => item.commit)).toEqual([commits.second, commits.first]);
	const [latest, earliest] = activity.work;
	expect(latest).toMatchObject({
		subject: 'feat: change src/utils/slugify.ts',
		branches: ['main', 'side'],
		reasonCount: 1,
		reasons: [{ unit: 'function.slugify', behavior: 'Fixture change.' }]
	});
	expect(latest.units).toContain('function.slugify');
	expect(Number.isFinite(Date.parse(latest.committedAt))).toBe(true);
	// A commit nobody explained has no reason, and none is written for it.
	expect([earliest.reasonCount, earliest.reasons]).toEqual([0, []]);
	expect((await shown(repo, ['--limit', '1'])).activity.work).toHaveLength(1);
	expect(JSON.stringify(await shown(repo))).not.toMatch(/foreign/i);
});

test('each changed file is listed once, at its latest commit, with the components that own it', async () => {
	const { activity } = await shown(repo);
	const file = (path: string) => activity.files.filter((item) => item.path === path);
	expect(file('src/utils/slugify.ts')).toEqual([
		expect.objectContaining({
			status: 'modified',
			commit: commits.second,
			units: ['function.slugify']
		})
	]);
	expect(file('src/services/TitleService.ts')).toEqual([
		expect.objectContaining({ status: 'added', commit: commits.first, units: ['service.title'] })
	]);
	expect(new Set(activity.files.map((item) => item.path)).size).toBe(activity.files.length);
});

test('what is not committed is told apart, for each checkout, and never listed as committed work', async () => {
	const { activity, live } = await shown(repo);
	const tree = (name: string) => live.worktrees.find((item) => item.name === name);
	expect(live.worktrees.map((item) => [item.name, item.branch, item.primary])).toEqual([
		['demo', 'main', true],
		['side', 'side', false]
	]);
	expect(tree('demo')?.changes).toEqual([
		{ path: 'src/utils/extra.ts', status: 'untracked', units: [] }
	]);
	expect(tree('side')?.changes).toEqual([
		{ path: 'notes.txt', status: 'untracked', units: [] },
		{ path: 'src/services/TitleService.ts', status: 'modified', units: ['service.title'] }
	]);
	const committed = activity.files.map((item) => item.path);
	expect(committed).not.toContain('src/utils/extra.ts');
	expect(committed).not.toContain('notes.txt');
});

test('a working agent is shown with its checkout and the components it says it works on', async () => {
	const args = ['activity', 'register', '--label', 'Side agent', '--units'];
	await repoAt(side).harness([...args, 'service.title,service.nothing']);
	await foreign.harness(['activity', 'register', '--label', 'Foreign agent']);
	const { live } = await shown(repo);
	expect([live.agents.tracking, live.agents.working]).toEqual(['available', 1]);
	expect(live.agents.roster).toEqual([
		expect.objectContaining({
			label: 'Side agent',
			worktree: 'side',
			units: ['service.nothing', 'service.title'],
			unknownUnits: ['service.nothing']
		})
	]);
	expect((await shown(foreign)).live.agents.roster.map((item) => item.label)).toEqual([
		'Foreign agent'
	]);
	// What Harness keeps about agents is its own, not a change of the project.
	const listed = live.worktrees.flatMap((item) => item.changes.map((change) => change.path));
	expect(listed.filter((path) => path.startsWith('.cache'))).toEqual([]);
});
