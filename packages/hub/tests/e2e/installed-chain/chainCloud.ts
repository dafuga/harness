import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const compatibilityDate = '2026-10-12';
const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const object = { type: 'durable-object' as const, storage: 'sqlite' as const };
const hosts = { type: 'durable-object' as const, worker: 'relay', exportName: 'RemoteHostObject' };

async function bundle(entry: string, external: string[]) {
	const result = await build({
		entryPoints: [source(entry)],
		bundle: true,
		format: 'esm',
		target: 'es2022',
		platform: 'neutral',
		external,
		write: false,
		logLevel: 'silent'
	});
	return { mainModule: 'index.js', modules: { 'index.js': esm(result.outputFiles[0].text) } };
}

const esm = (contents: string) => ({ type: 'esm' as const, contents });

async function sparePort(): Promise<number> {
	const server = createServer().listen(0, '127.0.0.1');
	await once(server, 'listening');
	const { port } = server.address() as { port: number };
	await new Promise((done) => server.close(done));
	return port;
}

async function workers(origin: string) {
	const [hub, relay] = await Promise.all([
		bundle('./chainHubWorker.ts', []),
		bundle('../../../../relay/src/index.ts', ['cloudflare:workers'])
	]);
	const hubEnv = {
		DB: { type: 'd1' as const, name: 'chain-db' },
		CACHE: { type: 'r2' as const, name: 'chain-cache' },
		RELAY: { type: 'worker' as const, worker: 'relay' },
		REMOTE_HOSTS: hosts,
		HARNESS_RELAY_ORIGIN: { type: 'text' as const, value: origin }
	};
	const relayEnv = {
		HARNESS_ENVIRONMENT: { type: 'text' as const, value: 'local' },
		REMOTE_HOSTS: hosts
	};
	const exports = { RemoteHostObject: object, AccountSyncObject: object };
	return [
		{ config: { name: 'hub', compatibilityDate, manifest: hub, env: hubEnv } },
		{ config: { name: 'relay', compatibilityDate, manifest: relay, env: relayEnv, exports } }
	];
}

async function migrate(db: D1Database) {
	const file = source('../../../db/migrations/0005-hub-home-chat.sql');
	const statements = readFileSync(file, 'utf8')
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('--'))
		.join('\n')
		.split(';');
	for (const sql of statements.map((entry) => entry.trim()).filter(Boolean))
		await db.prepare(sql).run();
}

/** The Hub and the relay in workerd. Nothing leaves the machine, and nothing is stored first. */
export async function startChainCloud() {
	const port = await sparePort();
	const origin = `http://127.0.0.1:${port}`;
	const miniflare = new Miniflare({
		cf: false,
		host: '127.0.0.1',
		port,
		workers: await workers(origin)
	});
	await miniflare.ready;
	await migrate((await miniflare.getD1Database('DB', 'hub')) as unknown as D1Database);
	const bucket = (await miniflare.getR2Bucket('CACHE', 'hub')) as unknown as R2Bucket;
	return {
		origin,
		/** Everything the Hub keeps for Home. The installed app publishes none of it. */
		stored: async () => (await bucket.list()).objects.map((entry) => entry.key),
		stop: () => miniflare.dispose()
	};
}
