import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runHarness } from './support/cli';
import { sessions } from './support/consoleHost';
import { bindBucket, buildStamped, emitted, historyBucket, seedBucket } from './support/hostBucket';
import { captureHost, keepCapture } from './support/hostCapture';
import { deployedWorker, weighed, withRecordedMedia } from './support/hostScale';
import { installArgs, pagesDev, syntheticHost, type SyntheticHost } from './support/installedHost';
import type { LocalWorker } from './support/workers';

/**
 * Measures the installed Cloudflare host against a real history index, which only exists where
 * a repository has one: set HARNESS_SCALE_INDEX to the output of `harness history build`. The
 * always-on proof of the same routes over a small history is console-storage.e2e.
 */
const index = process.env.HARNESS_SCALE_INDEX;
/** Skipped, and shown as skipped, wherever no index was named. */
const scaled = test.skipIf(!index);
/** What the platform allows a Worker script to weigh compressed, and the records added here. */
const limits = { freeMiB: 3, paidMiB: 10, records: 12 };
const mebibyte = 1024 * 1024;
const admin = { cookie: `session=${sessions.admin}` };
type Installed = {
	bundle: { files: number; bytes: number; compressedBytes: number } | null;
	warnings: string[];
};

let target: SyntheticHost;
let worker: LocalWorker;
let grown: string;
let media: string[];
const measured: Record<string, unknown> = {};
const install = async (data: string, extra: string[] = []): Promise<Installed> => {
	const flags = [
		...installArgs,
		'--host',
		target.host,
		'--data',
		data,
		...extra,
		'--update',
		'--json'
	];
	return JSON.parse((await runHarness(flags, target.root)).stdout) as Installed;
};
const get = (path: string, headers: Record<string, string> = admin) =>
	fetch(worker.url + path, { headers, redirect: 'manual' });

beforeAll(async () => {
	if (!index) return;
	target = await syntheticHost();
	await bindBucket(target.host);
	grown = join(target.root, 'grown-index');
	media = await withRecordedMedia(index ?? '', grown, limits.records);
	measured.bundledToday = await install(index ?? '');
	measured.bundledGrown = await install(grown);
	await install(grown, ['--bucket', historyBucket.binding, '--prefix', historyBucket.prefix]);
	measured.stamp = await buildStamped(target, 'a'.repeat(40));
	measured.worker = await deployedWorker(target.host);
	measured.objects = await seedBucket(target, grown);
	worker = await pagesDev(target.host, { persist: join(target.host, '.persist') });
}, 1_800_000);
afterAll(async () => {
	await worker?.stop();
	await target?.dispose();
});

scaled(
	'bundling cannot hold a recorded history, and the bucket keeps the Worker small',
	async () => {
		const today = measured.bundledToday as Installed;
		const later = measured.bundledGrown as Installed;
		const script = measured.worker as { bytes: number; compressedBytes: number };
		expect(later.bundle?.compressedBytes).toBeGreaterThan(limits.paidMiB * mebibyte);
		expect(later.warnings.join(' ')).toContain('Keep it in a private bucket with --bucket');
		expect(script.compressedBytes).toBeLessThan(limits.freeMiB * mebibyte);
		const stamped = await runHarness(
			['verify', 'identity', join(target.host, emitted), '--json'],
			target.root
		);
		expect(JSON.parse(stamped.stdout)).toMatchObject({
			buildId: measured.stamp,
			stamp: measured.stamp
		});
		const sizes = {
			limits,
			bundledToday: today.bundle,
			bundledWithRecords: later.bundle,
			deployedWorker: script,
			client: await weighed(join(target.host, emitted, 'output/client')),
			server: await weighed(join(target.host, emitted, 'output/server')),
			data: {
				index: { files: 1, bytes: (await readFile(join(grown, 'index.json'))).length },
				revisions: await weighed(join(grown, 'revisions')),
				sides: await weighed(join(grown, 'sides'))
			},
			media: await weighed(join(grown, 'media')),
			objects: measured.objects
		};
		Object.assign(measured, { sizes });
		expect(sizes.media.files).toBeGreaterThanOrEqual(media.length);
	}
);

scaled(
	'every revision, side and media file of that history is served from the bucket',
	async () => {
		const started = Date.now();
		const stored = JSON.parse(await (await get('/harness/data/index.json')).text()) as {
			revisions: Array<{ commit: string }>;
		};
		let bytes = 0;
		for (const { commit } of stored.revisions) {
			const answer = await get(`/harness/data/revisions/${commit}.json`);
			const text = await answer.text();
			expect([commit, answer.status]).toEqual([commit, 200]);
			expect(text).toBe(await readFile(join(grown, 'revisions', `${commit}.json`), 'utf8'));
			const side = (JSON.parse(text) as { side: string | null }).side;
			const sided = side ? await (await get(`/harness/data/${side}`)).text() : '';
			if (side) expect(sided).toBe(await readFile(join(grown, side), 'utf8'));
			bytes += text.length + sided.length;
		}
		const names = await readdir(join(grown, 'media'));
		for (const name of names) {
			const answer = await get(`/harness/media/${name}`);
			const body = Buffer.from(await answer.arrayBuffer());
			expect([name, answer.status]).toEqual([name, 200]);
			expect(body.equals(await readFile(join(grown, 'media', name)))).toBe(true);
			bytes += body.length;
		}
		expect((await get(`/harness/media/${media[0]}`, {})).status).toBe(403);
		expect((await get(`/history/media/${media[0]}`)).status).toBe(404);
		const served = { revisions: stored.revisions.length, media: names.length, bytes };
		Object.assign(measured, { served: { ...served, milliseconds: Date.now() - started } });
	},
	600_000
);

scaled(
	'the console of that history renders from the Worker, and what was measured is kept',
	async () => {
		// The newest commit of the index; the default branch of a real history may predate its registry.
		const stored = JSON.parse(await readFile(join(grown, 'index.json'), 'utf8')) as {
			revisions: Array<{ commit: string }>;
		};
		const page = `/harness?view=map&commit=${stored.revisions[0].commit}`;
		const capture = await captureHost(worker, join(target.root, 'evidence'), 'a'.repeat(40), page);
		expect(capture.reported.buildId).toBe(measured.stamp);
		await keepCapture('installed-host-own-history-desktop', capture, {
			index,
			artifact: measured.stamp
		});
		const directory = process.env.HARNESS_CAPTURE_DIR;
		if (!directory) return;
		await mkdir(directory, { recursive: true });
		const { sizes, served } = measured;
		await writeFile(
			join(directory, 'console-scale.json'),
			`${JSON.stringify({ index, sizes, served }, null, 2)}\n`
		);
	},
	120_000
);
