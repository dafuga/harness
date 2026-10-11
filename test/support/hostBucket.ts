import { appendFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ownEnvironment, runCommand, runHarness } from './cli';
import type { SyntheticHost } from './installedHost';

/** The private store of the synthetic host; local runs simulate it and nothing leaves the machine. */
export const historyBucket = {
	binding: 'HARNESS_HISTORY',
	name: 'harness-history',
	prefix: 'history'
};
/**
 * Everything the build emits. The Pages directory inside it holds the client files and a Worker
 * entry that imports the server output beside it, so the whole directory is what is deployed.
 */
export const emitted = '.svelte-kit';
const wrangler = resolve(import.meta.dirname, '../../node_modules/.bin/wrangler');

/** The host binds its own bucket in its own configuration; the installer does not touch it. */
export async function bindBucket(host: string): Promise<void> {
	const binding = `\n[[r2_buckets]]\nbinding = "${historyBucket.binding}"\nbucket_name = "${historyBucket.name}"\n`;
	await appendFile(join(host, 'wrangler.toml'), binding);
}

/** Builds the host at a stated revision of its own and stamps the artifact; returns the stamp. */
export async function buildStamped(target: SyntheticHost, revision: string): Promise<string> {
	const vite = resolve('node_modules/.bin/vite');
	await runCommand([vite, 'build'], target.host, true, { VITE_HARNESS_HOST_REVISION: revision });
	const stamped = await runHarness(
		['verify', 'stamp', join(target.host, emitted), '--json'],
		target.root
	);
	return (JSON.parse(stamped.stdout) as { buildId: string }).buildId;
}

/** Uploads the index into the simulated bucket the way a deployment uploads it to the real one. */
export async function seedBucket(target: SyntheticHost, data = target.data): Promise<number> {
	const listed = await runHarness(
		['console', 'objects', '--data', data, '--prefix', historyBucket.prefix, '--json'],
		target.root
	);
	const list = join(target.root, 'objects.json');
	await writeFile(list, listed.stdout);
	const settings = { ...ownEnvironment(), WRANGLER_SEND_METRICS: 'false', CI: '1' };
	const env = { ...settings, XDG_CONFIG_HOME: join(target.host, '.config') };
	const put = ['r2', 'bulk', 'put', historyBucket.name, '--filename', list, '--local'];
	await runCommand(
		[wrangler, ...put, '--persist-to', join(target.host, '.persist')],
		target.host,
		true,
		env
	);
	return (JSON.parse(listed.stdout) as unknown[]).length;
}
