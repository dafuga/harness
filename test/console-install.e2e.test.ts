import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';
import { hostRoute, sessions } from './support/consoleHost';
import {
	filesHolding,
	installAndBuild,
	installArgs,
	pagesDev,
	syntheticHost,
	type SyntheticHost
} from './support/installedHost';
import type { LocalWorker } from './support/workers';

let target: SyntheticHost;
let worker: LocalWorker;
let protectedPaths: string[];
const cookie = (session: string) => ({ cookie: `session=${session}` });
const get = (path: string, headers: Record<string, string> = {}) =>
	fetch(worker.url + path, { headers, redirect: 'manual' });

beforeAll(async () => {
	target = await syntheticHost();
	protectedPaths = [
		'/harness',
		'/harness/branch/main/pages',
		`/harness/branch/main/commit/${target.commit}/pages/page.titles/details?tab=source`,
		`/harness/commit/${target.commit}/map`,
		'/harness/data/index.json',
		`/harness/data/revisions/${target.commit}.json`,
		`/harness/media/${target.media}`,
		`/harness/export/${target.commit}`
	];
}, 600_000);
afterAll(async () => {
	await worker?.stop();
	await target?.dispose();
});

test('the installer refuses to serve anything without a policy of the host', async () => {
	const { host, root } = target;
	const unnamed = await runHarness(['console', 'install', '--host', host], root, false);
	expect(unnamed.exitCode).not.toBe(0);
	expect(unnamed.stderr).toContain("required option '--policy <module>' not specified");
	const absent = [...installArgs.slice(0, 3), '$lib/server/nobody', '--host', host];
	const missing = await runHarness(absent, root, false);
	expect(missing.exitCode).toBe(1);
	expect(missing.stderr).toContain('A host policy is required: $lib/server/nobody does not exist');
	// With a policy but no decision about the host's own /harness page, it still writes nothing.
	const unasked = await runHarness([...installArgs, '--host', host], root, false);
	expect(unasked.exitCode).toBe(1);
	expect(unasked.stderr).toContain(
		`${hostRoute.path} (host-owned: not written by harness console install)`
	);
	expect(await readdir(join(host, 'src/routes'))).toEqual(['+page.svelte', 'harness']);
	expect(await readFile(join(host, hostRoute.path), 'utf8')).toBe(hostRoute.contents);
});

test('the installed host builds for Workers and keeps history out of everything public', async () => {
	const { host, data, commit, media, index } = target;
	const result = JSON.parse(await installAndBuild(target)) as {
		written: string[];
		warnings: string[];
		changes: Array<{ path: string; action: string; reason: string; before: { saved: string } }>;
	};
	expect(result.warnings).toEqual([]);
	expect(result.written).toContain('src/routes/harness/[...view]/+server.ts');
	// The host's unprotected page was replaced on request, and what it held is kept in the project.
	expect(result.changes).toMatchObject([
		{ path: hostRoute.path, action: 'replaced', reason: 'host-owned' }
	]);
	expect(await readFile(join(host, result.changes[0].before.saved), 'utf8')).toBe(
		hostRoute.contents
	);
	const record = index.revisions.flatMap((revision) => revision.records)[0].id;
	const encoded = (await readFile(join(data, 'media', media))).toString('base64').slice(0, 48);
	const secrets = [commit, record, media.slice(0, 64), encoded];
	const holding = (tree: string) => filesHolding(join(host, tree), secrets);
	// History is compiled into the server and into nothing a browser may fetch directly: not
	// the directory Pages publishes, and not the client bundle.
	expect((await holding('.svelte-kit/output/server')).length).toBeGreaterThan(0);
	expect(await holding('.svelte-kit/cloudflare')).toEqual([]);
	expect(await holding('.svelte-kit/output/client')).toEqual([]);
	const published = await readdir(join(host, '.svelte-kit/cloudflare'));
	expect(published).toEqual(expect.arrayContaining(['_worker.js', 'robots.txt']));
}, 600_000);

test('in workerd only the host administrator reaches the console, its data and its media', async () => {
	const { commit, media, data, index } = target;
	worker = await pagesDev(target.host);
	const spoofed = {
		'x-forwarded-for': '127.0.0.1',
		'x-user-role': 'admin',
		forwarded: 'for=127.0.0.1'
	};
	const strangers = [{}, cookie(sessions.member), cookie('forged'), spoofed];
	for (const path of [...protectedPaths, '/harness/data/secret.json', '/harness/media/x']) {
		for (const headers of strangers) {
			const response = await get(path, headers);
			expect([path, response.status]).toEqual([path, 403]);
			expect(await response.text()).toBe('Forbidden');
		}
	}
	const admin = cookie(sessions.admin);
	// A page of the explorer and a page path of the earlier console are the same closed document.
	const explorer = await get(`/harness/branch/main/commit/${commit}/pages`, admin);
	const page = await get(`/harness/branch/main/commit/${commit}/map`, admin);
	for (const served of [explorer, page])
		expect([served.status, served.headers.get('cache-control')]).toEqual([
			200,
			'private, no-store'
		]);
	const html = await page.text();
	expect(await explorer.text()).toBe(html);
	expect(html).toContain('window.harnessConsole={"exportable":true,"base":"/harness"}');
	expect(html).not.toContain(commit);
	expect(await (await get('/harness/data/index.json', admin)).json()).toEqual(index);
	const detail = await get(`/harness/data/revisions/${commit}.json`, admin);
	expect(await detail.text()).toBe(await readFile(join(data, `revisions/${commit}.json`), 'utf8'));
	const image = await get(`/harness/media/${media}`, admin);
	const bytes = Buffer.from(await image.arrayBuffer());
	expect(image.headers.get('content-type')).toBe('image/png');
	expect(image.headers.get('cache-control')).toContain('private');
	expect(createHash('sha256').update(bytes).digest('hex')).toBe(media.slice(0, 64));
	const part = await get(`/harness/media/${media}`, { ...admin, range: 'bytes=0-7' });
	expect([part.status, Buffer.from(await part.arrayBuffer())]).toEqual([206, bytes.subarray(0, 8)]);
	// The portable report is built inside the Worker, with the recorded media inlined.
	const report = await get(`/harness/export/${commit}`, admin);
	expect([report.status, report.headers.get('content-disposition')]).toEqual([
		200,
		`attachment; filename="harness-${commit.slice(0, 12)}.html"`
	]);
	const portable = await report.text();
	expect(portable).toContain('window.projectReport=');
	expect(portable).toContain(`data:image/png;base64,${bytes.toString('base64')}`);
	for (const path of [`/harness/export/${'f'.repeat(40)}`, '/harness/data/secret.json']) {
		expect([path, (await get(path, admin)).status]).toEqual([path, 404]);
	}
}, 300_000);

test('no static path or alias reaches history, and the host keeps its own pages', async () => {
	const { commit, media } = target;
	const guesses = [
		'/harness/index.json',
		'/index.json',
		'/data/index.json',
		`/revisions/${commit}.json`,
		`/media/${media}`,
		'/src/lib/server/harness/data/index.json.ts',
		'/harness.console.json',
		'/wrangler.toml'
	];
	for (const path of guesses) {
		for (const headers of [{}, cookie(sessions.admin)]) {
			const response = await get(path, headers);
			const text = await response.text();
			expect([path, text.includes(commit), text.includes('"revisions"')]).toEqual([
				path,
				false,
				false
			]);
		}
	}
	const home = await get('/');
	expect([home.status, (await home.text()).includes('Synthetic host')]).toEqual([200, true]);
	expect((await get('/robots.txt')).status).toBe(200);
});

test('the mobile build of the same host still succeeds and carries no history', async () => {
	const { host, commit, media } = target;
	await runCommand([resolve('node_modules/.bin/vite'), 'build'], host, true, {
		BUILD_TARGET: 'mobile'
	});
	const files = await readdir(join(host, 'build'), { recursive: true });
	expect(files.some((file) => file.includes('_app'))).toBe(true);
	expect(await filesHolding(join(host, 'build'), [commit, media.slice(0, 64)])).toEqual([]);
}, 300_000);
