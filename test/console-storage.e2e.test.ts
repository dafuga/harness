import { existsSync } from 'node:fs';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runHarness } from './support/cli';
import { sessions } from './support/consoleHost';
import { bindBucket, buildStamped, emitted, historyBucket, seedBucket } from './support/hostBucket';
import { captureHost, judgeHost, keepCapture } from './support/hostCapture';
import {
	filesHolding,
	installArgs,
	pagesDev,
	syntheticHost,
	type SyntheticHost
} from './support/installedHost';
import type { LocalWorker } from './support/workers';

let target: SyntheticHost;
let worker: LocalWorker;
let earlier: LocalWorker;
let installed: { storage: unknown; data: { revisions: number; media: number }; bundle: unknown };
let uploaded: number;
const stamps = { earlier: '', current: '' };
// Revisions of the synthetic host application itself: labels its build is given, not Harness's.
const releases = { first: '1'.repeat(40), second: '2'.repeat(40) };
const admin = { cookie: `session=${sessions.admin}` };
const get = (path: string, headers: Record<string, string> = {}, from = worker) =>
	fetch(from.url + path, { headers, redirect: 'manual' });

beforeAll(async () => {
	target = await syntheticHost();
	await bindBucket(target.host);
	const stored = ['--bucket', historyBucket.binding, '--prefix', historyBucket.prefix];
	const flags = [...installArgs, '--host', target.host, '--data', target.data, ...stored];
	installed = JSON.parse((await runHarness([...flags, '--update', '--json'], target.root)).stdout);
	stamps.earlier = await buildStamped(target, releases.first);
	await cp(join(target.host, emitted), join(target.host, 'earlier', emitted), { recursive: true });
	// The application changes; its next build is another artifact with another stamp.
	const page = '<h1>Synthetic host</h1>\n<p>Second release of the host.</p>\n';
	await writeFile(join(target.host, 'src/routes/+page.svelte'), page);
	stamps.current = await buildStamped(target, releases.second);
	uploaded = await seedBucket(target);
	const persist = join(target.host, '.persist');
	worker = await pagesDev(target.host, { persist });
	earlier = await pagesDev(target.host, { directory: `earlier/${emitted}/cloudflare`, persist });
}, 900_000);
afterAll(async () => {
	await worker?.stop();
	await earlier?.stop();
	await target?.dispose();
});

test('with a bucket the history is in neither the host source nor anything it builds', async () => {
	expect(installed.storage).toEqual({
		kind: 'bucket',
		binding: 'HARNESS_HISTORY',
		prefix: 'history'
	});
	expect(installed.bundle).toBeNull();
	expect(uploaded).toBeGreaterThanOrEqual(installed.data.revisions + installed.data.media + 1);
	expect(existsSync(join(target.host, 'src/lib/server/harness/data'))).toBe(false);
	const secrets = [target.commit, target.media.slice(0, 64), 'service.title'];
	expect(await filesHolding(join(target.host, emitted), secrets)).toEqual([]);
});

test('the administrator reads the history from the bucket, and nobody reaches it another way', async () => {
	const index = await readFile(join(target.data, 'index.json'), 'utf8');
	expect(await (await get('/harness/data/index.json', admin)).text()).toBe(index);
	const detail = await (await get(`/harness/data/revisions/${target.commit}.json`, admin)).json();
	expect(detail).toMatchObject({ commit: target.commit, side: expect.stringMatching(/^sides\//) });
	const side = await get(`/harness/data/${(detail as { side: string }).side}`, admin);
	expect(await side.json()).toMatchObject({ schemaVersion: 1, files: expect.any(Array) });
	const bytes = await readFile(join(target.data, 'media', target.media));
	const media = await get(`/harness/media/${target.media}`, admin);
	expect([media.status, media.headers.get('content-type')]).toEqual([200, 'image/png']);
	expect(Buffer.from(await media.arrayBuffer()).equals(bytes)).toBe(true);
	const part = await get(`/harness/media/${target.media}`, { ...admin, range: 'bytes=1-3' });
	expect([part.status, await part.text()]).toEqual([206, 'PNG']);

	const guarded = ['/harness/data/index.json', `/harness/media/${target.media}`, '/harness'];
	for (const path of guarded) {
		const strangers: Array<Record<string, string>> = [{}, { cookie: `session=${sessions.member}` }];
		for (const stranger of strangers) {
			const refused = await get(path, stranger);
			expect([path, refused.status, await refused.text()]).toEqual([path, 403, 'Forbidden']);
		}
	}
	// The objects have no address of their own: not as assets, not under the bucket's names.
	const direct = ['/history/index.json', '/index.json', `/media/${target.media}`];
	const named = [`/harness-history/history/index.json`, `/history/media/${target.media}`];
	for (const path of [...direct, ...named]) {
		const answer = await get(path, admin);
		expect([path, answer.status]).toEqual([path, 404]);
		expect(await answer.text()).not.toContain(target.commit);
	}
});

test('nothing that depends on the session may be kept by a shared cache', async () => {
	const kept = async (path: string, headers: Record<string, string> = admin) => {
		const response = await get(path, headers);
		return [response.status, response.headers.get('cache-control')];
	};
	const head = (
		JSON.parse(await readFile(join(target.data, 'index.json'), 'utf8')) as {
			branches: Array<{ name: string; head: string }>;
		}
	).branches.find((branch) => branch.name === 'main')?.head;
	expect(await kept('/harness')).toEqual([308, 'no-store']);
	expect(await kept(`/harness?commit=${target.commit}`)).toEqual([308, 'no-store']);
	expect(await kept(`/harness/branch/main/commit/${head}/map`)).toEqual([200, 'private, no-store']);
	expect(await kept('/harness/data/index.json')).toEqual([200, 'no-store']);
	expect(await kept('/harness/data/build.json')).toEqual([200, 'no-store']);
	expect(await kept(`/harness/export/${target.commit}`)).toEqual([200, 'private, no-store']);
	const media = await kept(`/harness/media/${target.media}`);
	expect(media).toEqual([200, expect.stringMatching(/^private, /)]);
	expect(await kept('/harness', {})).toEqual([403, 'no-store']);
});

test('the Worker reports the stamp of the artifact it really runs', async () => {
	const identity = await runHarness(
		['verify', 'identity', join(target.host, emitted), '--json'],
		target.root
	);
	expect(JSON.parse(identity.stdout)).toMatchObject({
		buildId: stamps.current,
		stamp: stamps.current
	});
	expect(stamps.earlier).not.toBe(stamps.current);
	const sdk = JSON.parse(await readFile('package.json', 'utf8')) as {
		name: string;
		version: string;
	};
	expect(await (await get('/harness/data/build.json', admin)).json()).toEqual({
		buildId: stamps.current,
		sdk: { name: sdk.name, version: sdk.version },
		host: { revision: releases.second }
	});
	// The earlier artifact still says what it is, whatever it is served as.
	expect(await (await get('/harness/data/build.json', admin, earlier)).json()).toMatchObject({
		buildId: stamps.earlier,
		host: { revision: releases.first }
	});
	expect((await get('/harness/data/build.json')).status).toBe(403);
});

test('a capture from an earlier bundle is rejected although it is labelled with the verified commit', async () => {
	// The commit under verification, as a check is told it; both servers are labelled with it.
	const commit = process.env.HARNESS_VERIFY_REVISION ?? 'e'.repeat(40);
	const [fresh, old] = [join(target.root, 'evidence-fresh'), join(target.root, 'evidence-old')];
	const current = await captureHost(worker, fresh, commit);
	expect(judgeHost(fresh, commit, stamps.current)).toEqual([]);
	const stale = await captureHost(earlier, old, commit);
	expect(judgeHost(old, commit, stamps.current)).toEqual([
		`console-host: capture map-desktop.png was served by build ${stamps.earlier.slice(0, 12)}, not the console-host build ${stamps.current.slice(0, 12)} compiled from this revision`
	]);
	// The same pixels of the right build under another commit's label are refused as well.
	expect(judgeHost(fresh, 'd'.repeat(40), stamps.current)).toEqual([
		`console-host: capture map-desktop.png was produced by revision ${commit}, not ${'d'.repeat(40)}`
	]);
	const facts = { sourceCommit: commit, artifact: stamps.current, storage: installed.storage };
	await keepCapture('installed-host-bucket-desktop', current, facts);
	await keepCapture('installed-host-earlier-bundle-rejected', stale, {
		...facts,
		served: stamps.earlier
	});
}, 120_000);
