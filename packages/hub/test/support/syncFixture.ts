import type { SyncFixture, SyncStart } from './syncFixture.types';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SyncSocket } from './syncSocket';

const compatibilityDate = '2026-10-12';
const hubEntry = fileURLToPath(new URL('./syncWorker.ts', import.meta.url));
const relayEntry = fileURLToPath(new URL('../../../relay/src/index.ts', import.meta.url));
const migration = (name: string) =>
	readFileSync(new URL(`../../db/migrations/${name}.sql`, import.meta.url), 'utf8');
const baseMigrations = [
	'0001-auth-ephemeral-state',
	'0008-sealed-sync',
	'0010-sealed-recoveries',
	'0011-sealed-device-sessions',
	'0012-approval-push'
];

async function bundle(entry: string, external: string[]): Promise<string> {
	const result = await build({
		entryPoints: [entry],
		bundle: true,
		format: 'esm',
		target: 'es2022',
		platform: 'neutral',
		external,
		write: false,
		logLevel: 'silent'
	});
	return result.outputFiles[0].text;
}

const module = (contents: string) => ({ type: 'esm' as const, contents });
const object = { type: 'durable-object' as const, storage: 'sqlite' as const };

function bodyText(body: unknown): string | undefined {
	if (body === undefined || typeof body === 'string') return body;
	return JSON.stringify(body);
}

/** The statements of the migration without its comments, which hold rollback statements. */
function statements(name: string): string[] {
	const code = migration(name)
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('--'))
		.join('\n');
	return code
		.split(';')
		.map((statement) => statement.trim())
		.filter(Boolean);
}

function hubWorker(script: string) {
	return {
		config: {
			name: 'hub-sync',
			compatibilityDate,
			manifest: { mainModule: 'index.js', modules: { 'index.js': module(script) } },
			env: {
				DB: { type: 'd1' as const, name: 'sync-db' },
				CACHE: { type: 'r2' as const, name: 'sync-cache' },
				ACCOUNT_SYNC: {
					type: 'durable-object' as const,
					worker: 'relay',
					exportName: 'AccountSyncObject'
				}
			}
		}
	};
}

function relayWorker(script: string) {
	return {
		config: {
			name: 'relay',
			compatibilityDate,
			manifest: { mainModule: 'index.js', modules: { 'index.js': module(script) } },
			env: {
				REMOTE_HOSTS: {
					type: 'durable-object' as const,
					worker: 'relay',
					exportName: 'RemoteHostObject'
				}
			},
			exports: { AccountSyncObject: object, RemoteHostObject: object }
		}
	};
}

/**
 * The sealed sync API (the Hub's own policy code) and the relay's account objects in workerd,
 * joined by a namespace binding, with a real D1 database and R2 bucket. Nothing leaves the machine.
 */
export async function startSync(options: SyncStart = {}): Promise<SyncFixture> {
	const [hub, relay] = await Promise.all([
		bundle(options.entry ?? hubEntry, []),
		bundle(relayEntry, ['cloudflare:workers'])
	]);
	const miniflare = new Miniflare({
		cf: options.country ? { country: options.country } : false,
		host: '127.0.0.1',
		unsafeInspectDurableObjects: true,
		workers: [hubWorker(hub), relayWorker(relay)]
	});
	const origin = (await miniflare.ready).origin;
	const db = (await miniflare.getD1Database('DB', 'hub-sync')) as unknown as D1Database;
	for (const name of new Set([...baseMigrations, ...(options.migrations ?? [])]))
		for (const sql of statements(name)) await db.prepare(sql).run();
	await db.prepare('CREATE TABLE fixture_approval_deliveries (kind TEXT NOT NULL)').run();
	const sent: (string | Uint8Array)[] = [];
	const bucket = (await miniflare.getR2Bucket('CACHE', 'hub-sync')) as unknown as R2Bucket;
	return {
		origin,
		db,
		bucket,
		sent,
		call: (session, method, path, extra = {}) => {
			const { body, headers } = extra;
			const text = bodyText(body);
			const all = {
				...(session ? { 'x-test-session': session } : {}),
				...(typeof body === 'string' ? {} : { 'Content-Type': 'application/json' }),
				...headers
			};
			sent.push(`${method} /api/sync/v1/${path}`, ...Object.values(all), text ?? '');
			return fetch(origin + '/api/sync/v1/' + path, { method, headers: all, body: text });
		},
		socket: (session, device) =>
			SyncSocket.open(
				`${origin.replace('http', 'ws')}/api/sync/v1/live?session=${session}&device=${device}`,
				sent
			),
		objectRows: async (account) => {
			const storage = await miniflare.unsafeGetDurableObjectStorage('relay', 'AccountSyncObject', {
				name: account
			});
			const rows: unknown[] = [];
			for (const table of ['ring', 'enrollments'])
				rows.push(...(await storage.exec(`SELECT * FROM ${table}`)));
			return rows;
		},
		stop: () => miniflare.dispose()
	};
}
