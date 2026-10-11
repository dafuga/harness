import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { ownEnvironment } from './support/cli';
import {
	attach,
	directoryDigest,
	freshClone,
	harnessJson,
	sha256,
	withRemote
} from './support/historyRepo';
import { removeRemote } from './support/historyRepo';
import { legacyRun, png } from './support/legacyStore';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';
import { freePort } from './support/workers';

interface Index {
	legacy: Array<{
		id: string;
		status: string;
		startedAt: string;
		linked: string | null;
		media: Media[];
	}>;
	revisions: Array<{ commit: string; coverage: string }>;
}
interface Media {
	media: string | null;
	sha256: string;
	capturedAt?: string;
}

let baseline: VerifyRepo;
let reader: VerifyRepo;
let scratch: string;
let remote: string;
let server: ChildProcess;
let origin = '';
let head = '';
const made = { digest: '', record: '' };
const foreign = 'Legacy run run-elsewhere';
/** No stored credential, no helper, no prompt: Git answers from the clone or not at all. */
const offline = {
	GIT_TERMINAL_PROMPT: '0',
	GIT_ASKPASS: '/usr/bin/false',
	SSH_ASKPASS: '/usr/bin/false',
	GIT_CONFIG_GLOBAL: '/dev/null',
	GIT_CONFIG_NOSYSTEM: '1'
};
const index = () => join(scratch, 'clone-index');
const stored = async () => JSON.parse(await readFile(join(index(), 'index.json'), 'utf8')) as Index;

/** Waits until a server that was just started answers, or fails after half a minute. */
async function answering(url: string): Promise<void> {
	for (let attempt = 0; attempt < 150; attempt += 1) {
		const ok = await fetch(url).then(
			(answer) => answer.ok,
			() => false
		);
		if (ok) return;
		await new Promise((done) => setTimeout(done, 200));
	}
	throw new Error(`${url} did not answer`);
}

/** Records, imports and pushes a history; then removes everything it was made from. */
async function published(): Promise<void> {
	const writer = await cloneRepo(baseline);
	remote = await withRemote(writer);
	head = await writer.git(['rev-parse', 'HEAD']);
	const store = await mkdtemp(join(tmpdir(), 'harness-fresh-store-'));
	const target = { store, project: writer.root };
	await legacyRun(
		target,
		'run-passed',
		{ revision: head, startedAt: '2026-10-05T08:00:00.000Z' },
		40
	);
	const running = { status: 'running', state: 'active', startedAt: '2026-10-07T09:00:00.000Z' };
	await legacyRun(target, 'run-running', running, 90);
	const other = { project: { id: 'other', name: 'other', path: '/srv/other-project' } };
	await legacyRun(target, 'run-elsewhere', other, 200);
	made.record = (await writer.verify()).record.id;
	await attach(writer);
	await writer.harness(['history', 'import-reports', '--from', store]);
	await writer.harness(['history', 'build', '--out', join(scratch, 'original-index')]);
	made.digest = await directoryDigest(join(scratch, 'original-index'));
	await writer.harness(['history', 'push', 'origin']);
	await Promise.all([writer.dispose(), rm(store, { recursive: true, force: true })]);
	await rm(join(scratch, 'original-index'), { recursive: true, force: true });
}

beforeAll(async () => {
	scratch = await mkdtemp(join(tmpdir(), 'harness-fresh-viewer-'));
	baseline = await baselineRepo();
	await published();
	reader = await freshClone(remote);
	const absent = {
		HARNESS_ANALYTICS_HOME: join(scratch, 'no-analytics'),
		PROJECT_REPORTS_HOME: join(scratch, 'no-reports')
	};
	await harnessJson(reader, ['history', 'fetch', 'origin'], offline);
	await harnessJson(reader, ['history', 'build', '--out', index()], { ...offline, ...absent });
	const port = await freePort();
	origin = `http://127.0.0.1:${port}`;
	const viewer = {
		HOST: '127.0.0.1',
		PORT: String(port),
		HARNESS_OWNER_MODE: 'loopback',
		HARNESS_BIND: '127.0.0.1'
	};
	const data = {
		HARNESS_CONSOLE_DATA: index(),
		HARNESS_SITE_ROOT: reader.root,
		PROJECT_REPORTS_ASSET_STORAGE: 'local'
	};
	const env = {
		...ownEnvironment(),
		...offline,
		...absent,
		...viewer,
		...data,
		HARNESS_CLI_PATH: resolve('src/index.ts')
	};
	server = spawn('bun', [resolve('packages/reports/build/index.js')], { env, stdio: 'ignore' });
	await answering(`${origin}/api/health`);
}, 600_000);
afterAll(async () => {
	server?.kill();
	await Promise.all([baseline?.dispose(), reader?.dispose(), removeRemote(remote)]);
	await rm(scratch, { recursive: true, force: true });
});

test('a fresh clone rebuilds the same index from Git alone, with nothing it was made from left', async () => {
	expect(await directoryDigest(index())).toBe(made.digest);
	const built = await stored();
	expect(built.revisions.find((revision) => revision.commit === head)?.coverage).toBe('verified');
	// What was imported keeps its own dates and outcomes; a run that never finished stays running.
	expect(built.legacy.map((run) => [run.id, run.status, run.startedAt, run.linked])).toEqual([
		['run-passed', 'passed', '2026-10-05T08:00:00.000Z', head],
		['run-running', 'running', '2026-10-07T09:00:00.000Z', null]
	]);
	const [image] = built.legacy[1].media;
	expect(image).toMatchObject({ sha256: sha256(png(90)), capturedAt: '2026-10-07T09:05:00.000Z' });
	expect((await readFile(join(index(), image.media ?? ''))).equals(png(90))).toBe(true);
	// Nothing of the other project that shared the report store came along.
	for (const file of await readdir(index(), { recursive: true, withFileTypes: true })) {
		if (!file.isFile()) continue;
		const text = await readFile(join(file.parentPath, file.name), 'latin1');
		expect([file.name, text.includes(foreign) || text.includes('/srv/other-project')]).toEqual([
			file.name,
			false
		]);
	}
});

test('the viewer serves that history with no report store, no analytics and no credentials', async () => {
	const served = await fetch(`${origin}/harness/data/index.json`);
	expect(await served.text()).toBe(await readFile(join(index(), 'index.json'), 'utf8'));
	const built = await stored();
	const image = built.legacy[1].media[0];
	const media = await fetch(`${origin}/harness/${image.media}`);
	expect([media.status, Buffer.from(await media.arrayBuffer()).equals(png(90))]).toEqual([
		200,
		true
	]);
	const detail = await fetch(`${origin}/harness/data/revisions/${head}.json`);
	expect(await detail.json()).toMatchObject({ commit: head, records: [{ id: made.record }] });
	const page = await fetch(`${origin}/harness`);
	expect([page.status, new URL(page.url).pathname]).toEqual([
		200,
		`/harness/branch/main/commit/${head}/map`
	]);
	// The hub and the dashboard answer from empty stores and name no other project.
	const hub = await (await fetch(`${origin}/harness/reports`)).text();
	const dashboard = await fetch(`${origin}/harness/analytics`);
	expect([hub.includes(foreign), hub.includes('other-project'), dashboard.status]).toEqual([
		false,
		false,
		200
	]);
	expect(await (await fetch(`${origin}/api/reports`)).json()).toEqual([]);
});
