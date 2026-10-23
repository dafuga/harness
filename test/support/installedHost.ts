import type { SyntheticHost, HostIndex } from './installedHost.types';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runCommand, runHarness } from './cli';
import { writeConsoleHost } from './consoleHost';
import { baselineRepo } from './verifyRepo';
import { startWorker, type LocalWorker } from './workers';

/** A second branch of the indexed history; its name needs its slash kept and its `#` encoded. */
export const slashBranch = 'release/1.0#rc';
export const installArgs = ['console', 'install', '--policy', '$lib/server/harnessPolicy'];

/** Builds the history, packs Harness and installs the package into a fresh synthetic host. */
export async function syntheticHost(): Promise<SyntheticHost> {
	const root = await mkdtemp(join(tmpdir(), 'harness-console-host-'));
	const [host, data] = [join(root, 'host'), join(root, 'index')];
	const repo = await baselineRepo();
	// The fixture clip is a generated tone, so its transcript says so.
	const verified = await repo.verify([], { FIXTURE_TRANSCRIPT: 'Synthetic test tone. No speech.' });
	await repo.harness(['history', 'attach', '--record', verified.record.id]);
	await repo.git(['branch', slashBranch]);
	await repo.harness(['history', 'build', '--out', data]);
	const index = JSON.parse(await readFile(join(data, 'index.json'), 'utf8')) as HostIndex;
	const tarball = join(root, 'harness.tgz');
	await runCommand(['bun', 'pm', 'pack', '--ignore-scripts', '--filename', tarball], process.cwd());
	await writeConsoleHost(host, tarball);
	await runCommand(['bun', 'install'], host);
	return {
		root,
		host,
		data,
		index,
		commit: index.revisions.find((revision) => revision.records.length > 0)?.commit ?? '',
		media: (await readdir(join(data, 'media'))).find((name) => name.endsWith('.png')) ?? '',
		repo,
		async dispose() {
			await repo.dispose();
			await rm(root, { recursive: true, force: true });
		}
	};
}

/** Installs the console over the host's own /harness page on request, then builds for Workers. */
export async function installAndBuild(target: SyntheticHost): Promise<string> {
	const requested = [...installArgs, '--host', target.host, '--data', target.data, '--update'];
	const installed = await runHarness([...requested, '--json'], target.root);
	await runCommand([resolve('node_modules/.bin/vite'), 'build'], target.host);
	return installed.stdout;
}

/**
 * The built host in Wrangler's local Pages runtime: its artifact, or another directory when an
 * earlier artifact is served, with local bindings kept in `persist` when the host has any.
 */
export function pagesDev(
	host: string,
	served: { directory?: string; persist?: string } = {}
): Promise<LocalWorker> {
	return startWorker(host, ({ port, inspector }) => [
		'pages',
		'dev',
		served.directory ?? '.svelte-kit/cloudflare',
		'--ip',
		'127.0.0.1',
		'--port',
		String(port),
		'--inspector-port',
		String(inspector),
		...(served.persist ? ['--persist-to', served.persist] : [])
	]);
}

/** Files of one build output tree that contain any of the given strings. */
export async function filesHolding(directory: string, secrets: string[]): Promise<string[]> {
	const entries = await readdir(directory, { recursive: true, withFileTypes: true });
	const found: string[] = [];
	for (const entry of entries.filter((item) => item.isFile())) {
		const text = await readFile(join(entry.parentPath, entry.name), 'latin1');
		if (secrets.some((secret) => text.includes(secret))) found.push(entry.name);
	}
	return found;
}

export type { HostIndex, SyntheticHost } from './installedHost.types';
