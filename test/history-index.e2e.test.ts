import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	build,
	detail,
	indexedRepo,
	type Detail,
	type IndexedCommits
} from './support/historyIndexFixture';
import {
	attach,
	directoryDigest,
	freshClone,
	harnessJson,
	removeRemote,
	sha256,
	withRemote
} from './support/historyRepo';
import { cloneRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';

let repo: VerifyRepo;
let commits: IndexedCommits;
let changed: VerifyOutcome;

beforeAll(async () => {
	({ repo, commits, changed } = await indexedRepo());
}, 240_000);
afterAll(() => repo.dispose());

test('the index is deterministic and names every commit, verified or not', async () => {
	const one = join(repo.root, '.cache/history-one');
	const two = join(repo.root, '.cache/history-two');
	const built = await build(repo, one);
	await build(repo, two);
	expect(existsSync(join(one, 'catalog.sqlite'))).toBe(true);
	expect(await directoryDigest(one)).toBe(await directoryDigest(two));
	expect(sha256(await readFile(join(one, 'index.json')))).toBe(built.digest);
	const { index } = built;
	expect([index.schemaVersion, index.problems, index.branches]).toEqual([
		1,
		[],
		[{ name: 'main', head: commits.unverified }]
	]);
	const by = (commit: string) => index.revisions.find((revision) => revision.commit === commit);
	expect(index.revisions.map((revision) => revision.commit)).toEqual([
		commits.unverified,
		commits.changed,
		commits.baseline,
		commits.failed
	]);
	expect(by(commits.unverified)).toMatchObject({
		coverage: 'unverified',
		gaps: ['no verification record is attached to this commit'],
		records: [],
		subject: 'chore: not verified yet'
	});
	expect(by(commits.failed)).toMatchObject({ coverage: 'failed', records: [{ status: 'failed' }] });
	expect(by(commits.baseline)).toMatchObject({ coverage: 'verified', gaps: [] });
	expect(by(commits.changed)).toMatchObject({
		coverage: 'verified',
		records: [{ id: changed.record.id, status: 'passed', valid: true }]
	});
	expect(by(commits.changed)?.committedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	await rm(two, { recursive: true });
}, 240_000);

/** Every capture, inherited ones included, points at a file holding exactly its bytes. */
async function expectResolvedMedia(out: string, record: Detail['records'][number]): Promise<void> {
	const captures = record.scenarios.flatMap((scenario) =>
		scenario.states.flatMap((state) => state.captures)
	);
	expect(captures.length).toBeGreaterThan(6);
	for (const capture of captures) {
		expect(capture.media).toMatch(new RegExp(`^media/${capture.sha256}\\.[a-z0-9]+$`));
		expect(sha256(await readFile(join(out, capture.media ?? '')))).toBe(capture.sha256);
	}
}

test('a revision carries its graph, comparison, inherited provenance, media and reasons', async () => {
	const out = join(repo.root, '.cache/history-detail');
	const { index, media } = await build(repo, out);
	const summary = index.revisions.find((revision) => revision.commit === commits.changed);
	const revision = await detail(out, summary);
	expect(revision.registry.available).toBe(true);
	expect(revision.registry.units.map((unit) => unit.id)).toEqual(
		expect.arrayContaining(['function.slugify', 'service.title', 'page.titles'])
	);
	expect(revision.registry.graph.edges).toContainEqual({
		from: 'unit:service.title',
		to: 'unit:function.slugify',
		via: 'import'
	});
	expect(revision.comparison).toMatchObject({
		base: commits.baseline,
		units: { direct: ['function.slugify'], indirect: ['page.titles', 'service.title'], added: [] }
	});
	const [record] = revision.records;
	const page = record.scenarios.find((scenario) => scenario.id === 'titles-page');
	expect(page).toMatchObject({
		status: 'passed',
		inherited: false,
		origin: { record: changed.record.id, commit: commits.changed }
	});
	const clock = record.scenarios.find((scenario) => scenario.id === 'clock');
	expect(clock).toMatchObject({
		status: 'referenced',
		inherited: true,
		origin: { record: changed.record.source.baseRecord, commit: commits.baseline }
	});
	await expectResolvedMedia(out, record);
	expect(media.missing).toBe(0);
	expect(revision.explanations).toContainEqual(
		expect.objectContaining({
			unit: 'function.slugify',
			symbol: 'slugify',
			behavior: 'Fixture change.'
		})
	);
	const untested = await detail(
		out,
		index.revisions.find((item) => item.commit === commits.unverified)
	);
	expect([untested.records, untested.comparison, untested.registry.available]).toEqual([
		[],
		null,
		true
	]);
}, 240_000);

test('growth and benchmarks are kept per unit, and another profile is a separate series', async () => {
	const other = await cloneRepo(repo);
	await other.git(['checkout', '-q', commits.changed]);
	await other.git(['checkout', '-q', '-B', 'main']);
	const elsewhere = await other.verify(['--base', 'none'], {
		HARNESS_PROFILE_LABEL: 'another-runner'
	});
	expect(elsewhere.record.status).toBe('failed');
	await attach(other, ['--record', elsewhere.record.id]);
	const { index } = await build(other, join(other.root, '.cache/history'));
	const slugify = index.units.find((unit) => unit.id === 'function.slugify');
	expect(slugify?.growth.map((point) => [point.commit, point['source-bytes']])).toEqual(
		expect.arrayContaining([
			[commits.baseline, 87],
			[commits.changed, 87]
		])
	);
	const latency = index.benchmarks.find(
		(item) => item.unit === 'service.title' && item.metric === 'latency-warm-ms'
	);
	expect(latency).toMatchObject({ workload: 'titles-1k', incompatible: true });
	expect(latency?.series.map((series) => series.profile).sort()).toEqual(
		[changed.record.profile.id, elsewhere.record.profile.id].sort()
	);
	expect(latency?.series.every((series) => series.unitOfMeasure === 'ms')).toBe(true);
	await other.dispose();
}, 240_000);

/** Without its media objects, the same clone states the gap instead of substituting anything. */
async function expectMissingMedia(
	reader: VerifyRepo,
	offline: Record<string, string>
): Promise<void> {
	await rm(join(reader.root, '.git/lfs/objects'), { recursive: true });
	const partial = await build(reader, join(reader.root, '.cache/history-partial'), offline);
	expect(partial.media.missing).toBeGreaterThan(0);
	expect(partial.problems).toContainEqual(
		expect.stringMatching(/media .+ is not available locally; run harness history fetch/)
	);
	const summary = partial.index.revisions.find((item) => item.commit === commits.changed);
	expect(summary).toMatchObject({ coverage: 'invalid' });
	const revision = await detail(join(reader.root, '.cache/history-partial'), summary);
	const image = revision.records[0].scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.find((capture) => capture.media === null);
	expect(image?.gap).toMatch(/is not available locally/);
	const strict = await reader.run([
		'history',
		'build',
		'--out',
		'.cache/history-strict',
		'--strict'
	]);
	expect(strict.exitCode).toBe(1);
}

test('a fresh clone rebuilds the same index from Git alone, and missing media is a stated gap', async () => {
	const out = join(repo.root, '.cache/history-origin');
	const original = await build(repo, out);
	const remote = await withRemote(repo);
	await harnessJson(repo, ['history', 'push', 'origin']);
	const reader = await freshClone(remote);
	const offline = {
		PROJECT_REPORTS_HOME: join(reader.root, 'no-such-store'),
		HARNESS_ANALYTICS_DISABLED: '1'
	};
	await harnessJson(reader, ['history', 'fetch', 'origin'], offline);
	const rebuilt = await build(reader, join(reader.root, '.cache/history'), offline);
	expect(rebuilt.digest).toBe(original.digest);
	expect(await directoryDigest(join(reader.root, '.cache/history'))).toBe(
		await directoryDigest(out)
	);
	expect(existsSync(join(reader.root, '.cache/harness/analytics.sqlite'))).toBe(false);

	await expectMissingMedia(reader, offline);
	await Promise.all([reader.dispose(), removeRemote(remote)]);
}, 300_000);
