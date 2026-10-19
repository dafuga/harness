import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { expect } from '../../../../test/verificationExpect';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
/** Valid pages added in ordinary authoring order, intentionally different from lexical order. */
export async function sveltePreviewFixture(root: string, dependencies: string) {
	await symlink(dependencies, join(root, 'node_modules'), 'dir');
	const routes = ['pages', 'shells', 'components', 'configs', 'functions', 'services', 'a-first'];
	const files: Record<string, string> = {
		'package.json': '{"type":"module"}',
		'vite.config.mjs':
			'import {sveltekit} from "@sveltejs/kit/vite";export default {plugins:[sveltekit()]};',
		'svelte.config.js': 'export default {};',
		'src/app.html':
			'<!doctype html><html><head>%sveltekit.head%</head><body><div style="display:contents">%sveltekit.body%</div></body></html>'
	};
	for (const name of routes) files[`src/routes/${name}/+page.svelte`] = `<h1>${name}</h1>`;
	for (const [path, text] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), text);
	}
	return routes;
}

export async function assertPreviewRoutes(
	root: string,
	url: string,
	names: string[],
	log: () => string
) {
	try {
		await expect
			.poll(
				async () => {
					try {
						return (await (await fetch(url + '/pages')).text()).includes('node_ids:');
					} catch {
						return false;
					}
				},
				{ timeout: 20000 }
			)
			.toBe(true);
	} catch (cause) {
		throw new Error('Preview fixture did not start: ' + log(), { cause });
	}
	const pages = await Promise.all(
		names.map(async (name) => ({ name, html: await (await fetch(url + '/' + name)).text() }))
	);
	execFileSync('bun', ['x', 'svelte-kit', 'sync'], { cwd: root, stdio: 'pipe' });
	for (const page of pages) {
		const ids = JSON.parse(/node_ids: (\[[^\]]+\])/.exec(page.html)![1]) as number[];
		const leaf = await (
			await fetch(url + `/.svelte-kit/generated/client/nodes/${ids.at(-1)}.js`)
		).text();
		expect(leaf, 'managed routes must hydrate their own components').toContain(
			`/${page.name}/+page.svelte`
		);
	}
}

const reports = fileURLToPath(new URL('../..', import.meta.url));
const roots: string[] = [],
	children: ChildProcess[] = [];
afterEach(async () => {
	for (const child of children.splice(0)) {
		if (child.exitCode !== null || child.signalCode !== null) continue;
		const ended = once(child, 'exit');
		process.kill(-child.pid!, 'SIGTERM');
		await ended;
	}
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
export async function previewPort() {
	const server = createServer();
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const value = (server.address() as AddressInfo).port;
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return value;
}
export async function previewFixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-preview-lifecycle-'));
	roots.push(root);
	await writeFile(join(root, 'index.html'), '<h1>Managed preview fixture</h1>');
	await writeFile(
		join(root, 'vite.config.mjs'),
		`export default {plugins:[{name:'lifecycle-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/fixture-worker'){res.setHeader('content-type','application/json');res.end(JSON.stringify({pid:process.pid}));}else if(req.url==='/fixture-fail.js'){res.statusCode=500;res.end('fixture module failure');}else next();});}}]};`
	);
	return { root, owner: await previewPort() };
}
export function startPreview(
	f: Awaited<ReturnType<typeof previewFixture>> & { app?: boolean },
	webPort: number,
	history = 'one',
	configFile = join(f.root, 'vite.config.mjs')
) {
	const child = spawn(
		'bun',
		[
			...(f.app ? [join(reports, 'src/initializers/initializePreview.ts')] : ['run', 'dev']),
			f.root,
			'--config',
			configFile,
			'--port',
			String(webPort)
		],
		{
			cwd: f.app ? f.root : reports,
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				NO_COLOR: '1',
				HARNESS_PREVIEW_OWNER_PORT: String(f.owner),
				HARNESS_CONSOLE_DATA: history
			}
		}
	);
	children.push(child);
	let text = '';
	child.stdout!.on('data', (data) => {
		text += String(data);
	});
	child.stderr!.on('data', (data) => {
		text += String(data);
	});
	return { child, text: () => text };
}
export async function readyPreview(webPort: number) {
	await expect
		.poll(
			async () => {
				try {
					return await (
						await fetch(`http://127.0.0.1:${webPort}`, { signal: AbortSignal.timeout(500) })
					).text();
				} catch {
					return '';
				}
			},
			{ timeout: 15000 }
		)
		.toContain('Managed preview fixture');
}
export async function exitedPreview(run: ReturnType<typeof startPreview>) {
	await expect.poll(() => run.child.exitCode, { timeout: 4000 }).not.toBeNull();
}

/** The published owner is ready before a lifecycle fault is injected. */
export async function publishedPreviewOwner(port: number, webPort: number) {
	const read = () => fetch(`http://127.0.0.1:${port}/__harness_preview__`).then((r) => r.json());
	await expect.poll(async () => (await read()).url).toBe(`http://127.0.0.1:${webPort}`);
	return read();
}
export async function previewWorkerPid(webPort: number): Promise<number> {
	try {
		const response = await fetch(`http://127.0.0.1:${webPort}/fixture-worker`, {
			signal: AbortSignal.timeout(500)
		});
		return (await response.json()).pid;
	} catch {
		return 0;
	}
}
