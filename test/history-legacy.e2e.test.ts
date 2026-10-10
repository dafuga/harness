import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	directoryDigest,
	evidenceRef,
	harnessJson,
	noteLines,
	sha256,
	statusOf
} from './support/historyRepo';
import { legacyRun, png } from './support/legacyStore';
import { baselineRepo, type VerifyRepo } from './support/verifyRepo';

interface Imported {
	imported: Array<{
		id: string;
		status: string;
		startedAt: string;
		revision: string | null;
		linked: string | null;
		media: number;
		created: boolean;
	}>;
	skipped: Array<{ id: string; reason: string }>;
}
interface LegacyEntry {
	id: string;
	status: string;
	startedAt: string;
	updatedAt: string;
	revision: string | null;
	linked: string | null;
	gap?: string;
	media: Array<{
		file: string;
		provenance: string;
		media: string | null;
		sha256: string;
		capturedAt?: string;
	}>;
}

let repo: VerifyRepo;
let store: string;
let head: string;
const unknown = 'deadbeef'.repeat(5);

beforeAll(async () => {
	repo = await baselineRepo();
	head = await repo.git(['rev-parse', 'HEAD']);
	store = await mkdtemp(join(tmpdir(), 'harness-legacy-store-'));
	const target = { store, project: repo.root };
	await legacyRun(
		target,
		'run-passed',
		{ revision: head, startedAt: '2026-10-05T08:00:00.000Z' },
		40
	);
	await legacyRun(
		target,
		'run-running',
		{ status: 'running', state: 'active', startedAt: '2026-10-07T09:00:00.000Z' },
		90
	);
	await legacyRun(target, 'run-failed', {
		status: 'failed',
		revision: unknown,
		startedAt: '2026-10-06T08:00:00.000Z'
	});
	await legacyRun(
		target,
		'run-elsewhere',
		{ project: { id: 'other', name: 'other', path: '/srv/other-project' } },
		200
	);
}, 120_000);
afterAll(async () => {
	await chmod(store, 0o700).catch(() => undefined);
	await Promise.all([repo.dispose(), rm(store, { recursive: true, force: true })]);
});

const importReports = () =>
	harnessJson<Imported>(repo, ['history', 'import-reports', '--from', store]);

test('legacy reports keep their dates, outcomes and revisions, and only this repository is imported', async () => {
	const before = await directoryDigest(store);
	const result = await importReports();
	expect(await directoryDigest(store)).toBe(before);
	expect(result.imported).toEqual([
		{
			id: 'run-passed',
			status: 'passed',
			startedAt: '2026-10-05T08:00:00.000Z',
			revision: head,
			linked: head,
			media: 1,
			created: true
		},
		{
			id: 'run-failed',
			status: 'failed',
			startedAt: '2026-10-06T08:00:00.000Z',
			revision: unknown,
			linked: null,
			media: 0,
			created: true
		},
		{
			id: 'run-running',
			status: 'running',
			startedAt: '2026-10-07T09:00:00.000Z',
			revision: null,
			linked: null,
			media: 1,
			created: true
		}
	]);
	expect(result.skipped).toEqual([{ id: 'run-elsewhere', reason: 'belongs to another project' }]);

	const listed = await repo.git(['ls-tree', '-r', '--name-only', evidenceRef]);
	expect(listed).not.toContain('run-elsewhere');
	const legacy = (await noteLines(repo)).filter((line) => line.kind === 'legacy-report');
	expect(legacy.map((line) => [line.id, line.status])).toEqual([['run-passed', 'passed']]);
	const status = await statusOf(repo);
	expect([status.verified, status.records]).toEqual([false, []]);

	const tip = await repo.git(['rev-parse', evidenceRef]);
	const again = await importReports();
	expect(again.imported.map((item) => item.created)).toEqual([false, false, false]);
	expect(await repo.git(['rev-parse', evidenceRef])).toBe(tip);
}, 180_000);

test('the index shows legacy runs as recorded: running stays running and unlinked stays unlinked', async () => {
	await importReports();
	const out = join(repo.root, '.cache/history');
	const built = await harnessJson<{
		index: {
			legacy: LegacyEntry[];
			revisions: Array<{ commit: string; coverage: string; legacy: string[] }>;
		};
	}>(repo, ['history', 'build', '--out', out]);
	const entries = built.index.legacy;
	expect(
		entries.map((entry) => [
			entry.id,
			entry.status,
			entry.startedAt,
			entry.updatedAt,
			entry.revision,
			entry.linked
		])
	).toEqual([
		['run-passed', 'passed', '2026-10-05T08:00:00.000Z', '2026-10-07T09:10:00.000Z', head, head],
		['run-failed', 'failed', '2026-10-06T08:00:00.000Z', '2026-10-07T09:10:00.000Z', unknown, null],
		['run-running', 'running', '2026-10-07T09:00:00.000Z', '2026-10-07T09:10:00.000Z', null, null]
	]);
	expect(entries.map((entry) => entry.gap)).toEqual([
		undefined,
		`recorded revision ${unknown} is not a commit in this repository`,
		'no tested revision was recorded'
	]);
	const [image] = entries[2].media;
	expect(image).toMatchObject({
		file: 'run-running-desktop.png',
		provenance: 'legacy-report',
		capturedAt: '2026-10-07T09:05:00.000Z',
		sha256: sha256(png(90))
	});
	expect((await readFile(join(out, image.media ?? ''))).equals(png(90))).toBe(true);
	const revision = built.index.revisions.find((item) => item.commit === head);
	expect(revision).toMatchObject({ legacy: ['run-passed'] });
	expect(revision?.coverage).not.toBe('verified');
}, 180_000);

test('the legacy store is only read, even when it cannot be written', async () => {
	const copy = await mkdtemp(join(tmpdir(), 'harness-legacy-readonly-'));
	await rm(copy, { recursive: true });
	await repo.git(['update-ref', '-d', evidenceRef]);
	await repo.git(['update-ref', '-d', 'refs/notes/harness']);
	const { cp } = await import('node:fs/promises');
	await cp(store, copy, { recursive: true });
	const before = await directoryDigest(copy);
	for (const path of ['runs/run-passed/assets', 'runs/run-passed', 'runs', '.']) {
		await chmod(join(copy, path), 0o500);
	}
	const result = await harnessJson<Imported>(repo, ['history', 'import-reports', '--from', copy]);
	expect(result.imported.map((item) => item.id)).toEqual([
		'run-passed',
		'run-failed',
		'run-running'
	]);
	for (const path of ['.', 'runs', 'runs/run-passed', 'runs/run-passed/assets']) {
		await chmod(join(copy, path), 0o700);
	}
	expect(await directoryDigest(copy)).toBe(before);
	await rm(copy, { recursive: true, force: true });
}, 180_000);
