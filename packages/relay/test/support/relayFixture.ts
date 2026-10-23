import type {
	Binding,
	RelayOptions,
	RelayFixture,
	Fetcher,
	ExtraWorker,
	BindingCall,
	StoredRow
} from './relayFixture.types';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../../src/index.ts', import.meta.url));
const className = 'RemoteHostObject';
const compatibilityDate = '2026-10-12';
/** The one browser origin the relay under test lets through. */
export const allowedOrigin = 'https://allowed.example';

/**
 * Stands in for the hub: a second Worker whose only way to the relay is a namespace binding to
 * its class. It passes the path, the verb and the body to the object named by `?object=`.
 */
const hubScript = `export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const id = env.REMOTE_HOSTS.idFromName(url.searchParams.get('object') ?? '');
		const body = request.method === 'GET' ? undefined : await request.text();
		const target = 'https://relay.internal' + url.pathname;
		return env.REMOTE_HOSTS.get(id).fetch(target, { method: request.method, body });
	}
};`;
/** A binding to the relay's host objects, as the hub declares it. */
export const relayBinding: Binding = {
	type: 'durable-object',
	worker: 'relay',
	exportName: className
};

/** Bundles the Worker and runs it in workerd beside the hub stand-in. Nothing leaves the machine. */
export async function startRelay(options: RelayOptions = {}): Promise<RelayFixture> {
	const script = await bundle();
	const miniflare = new Miniflare({
		cf: false,
		host: '127.0.0.1',
		...(options.port ? { port: options.port } : {}),
		unsafeInspectDurableObjects: true,
		workers: [
			relayWorker('relay', script, 'local'),
			hubWorker(),
			relayWorker('relay-production', script, 'production'),
			...(options.workers ?? []).map(extraWorker)
		]
	});
	const origin = (await miniflare.ready).origin;
	const hub = (await miniflare.getWorker('hub')) as unknown as { fetch: Fetcher };
	const strict = (await miniflare.getWorker('relay-production')) as unknown as { fetch: Fetcher };
	return {
		origin,
		socketOrigin: origin.replace(/^http/, 'ws'),
		fetch: (path, init) => fetch(origin + path, init),
		post: (path, body) => fetch(origin + path, jsonInit(body)),
		manage: (operation, body, call = {}) =>
			hub.fetch(bindingUrl(operation, body, call), bindingInit(body, call)),
		strict: (url, init) => strict.fetch(url, init),
		rows: (hostId) => storedRows(miniflare, hostId),
		worker: async (name) => (await miniflare.getWorker(name)) as unknown as { fetch: Fetcher },
		stop: () => miniflare.dispose()
	};
}

async function bundle(): Promise<string> {
	const result = await build({
		entryPoints: [entry],
		bundle: true,
		format: 'esm',
		target: 'es2022',
		platform: 'neutral',
		external: ['cloudflare:workers'],
		write: false,
		logLevel: 'silent'
	});
	return result.outputFiles[0].text;
}

function relayWorker(name: string, script: string, environment: string) {
	return {
		config: {
			name,
			compatibilityDate,
			manifest: { mainModule: 'index.js', modules: { 'index.js': module(script) } },
			env: {
				HARNESS_ENVIRONMENT: { type: 'text' as const, value: environment },
				HARNESS_RELAY_ALLOWED_ORIGINS: { type: 'text' as const, value: allowedOrigin },
				REMOTE_HOSTS: { type: 'durable-object' as const, worker: name, exportName: className }
			},
			exports: { [className]: { type: 'durable-object' as const, storage: 'sqlite' as const } }
		}
	};
}

function hubWorker() {
	return {
		config: {
			name: 'hub',
			compatibilityDate,
			manifest: { mainModule: 'index.js', modules: { 'index.js': module(hubScript) } },
			env: {
				REMOTE_HOSTS: { type: 'durable-object' as const, worker: 'relay', exportName: className }
			}
		}
	};
}

function extraWorker(worker: ExtraWorker) {
	const exported = (worker.objects ?? []).map((name) => [
		name,
		{ type: 'durable-object' as const, storage: 'sqlite' as const }
	]);
	return {
		config: {
			name: worker.name,
			compatibilityDate,
			manifest: { mainModule: 'index.js', modules: { 'index.js': module(worker.script) } },
			env: worker.env ?? {},
			...(exported.length ? { exports: Object.fromEntries(exported) } : {})
		}
	};
}

function module(contents: string) {
	return { type: 'esm' as const, contents };
}

function jsonInit(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	};
}

function bindingUrl(operation: string, body: Record<string, unknown>, call: BindingCall): string {
	const object = call.object ?? String(body.hostId ?? '');
	const path = call.path ?? `/manage/${operation}`;
	return `http://hub.test${path}?object=${encodeURIComponent(object)}`;
}

function bindingInit(body: Record<string, unknown>, call: BindingCall): RequestInit {
	const method = call.method ?? 'POST';
	return method === 'GET' ? { method } : { method, body: JSON.stringify(body) };
}

async function storedRows(miniflare: Miniflare, hostId: string): Promise<StoredRow[]> {
	const storage = await miniflare.unsafeGetDurableObjectStorage('relay', className, {
		name: hostId
	});
	const tables = await storage.exec("SELECT name FROM sqlite_master WHERE name = 'records'");
	if (tables.length === 0) return [];
	return storage.exec<{ key: string; value: string }>(
		'SELECT key, value FROM records ORDER BY key'
	);
}

export type {
	StoredRow,
	BindingCall,
	ExtraWorker,
	RelayOptions,
	RelayFixture
} from './relayFixture.types';
