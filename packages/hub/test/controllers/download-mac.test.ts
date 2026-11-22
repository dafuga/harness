import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { beforeAll, expect, test, vi } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import * as route from '../../src/routes/downloads/[asset]/+server';

// Router tests run the built app (`vite build`) through SvelteKit's own Server and compiled manifest.
const hubRoot = fileURLToPath(new URL('../..', import.meta.url));
const load = (path: string) => import(pathToFileURL(`${hubRoot}/.svelte-kit/${path}`).href);
let router: {
	init(options: Record<string, unknown>): Promise<void>;
	respond(request: Request, options: Record<string, unknown>): Promise<Response>;
};
beforeAll(async () => {
	await promisify(execFile)('bun', ['x', 'vite', 'build'], { cwd: hubRoot });
	const { Server } = (await load('output/server/index.js')) as {
		Server: new (m: unknown) => typeof router;
	};
	const { manifest } = (await load('cloudflare-tmp/manifest.js')) as { manifest: unknown };
	router = new Server(manifest);
	await router.init({ env: {}, read: () => Promise.reject(new Error('no static read')) });
}, 180_000);

/** A request through the built app's router, with the platform env the route receives. */
function viaRouter(path: string, method: string, env: Record<string, unknown>): Promise<Response> {
	const request = new Request(new URL(path, 'https://hub.example'), { method, redirect: 'manual' });
	return router.respond(request, { platform: { env }, getClientAddress: () => '127.0.0.1' });
}

// Synthetic fixtures only: a fake archive under the vetted key shape, never a real release.
const ARCHIVE = 'Harness-mac-arm64.zip';
const SHA = '0123456789abcdef0123456789abcdef01234567';
const KEY = `releases/mac-arm64/${SHA}/Harness.zip`;
const PATH = `/downloads/${ARCHIVE}`;
const FAKE = new TextEncoder().encode('synthetic zip bytes');

/** An R2-shaped stub. Every call is a spy so a test can prove what storage was (or was not) used. */
function stubBucket(objects: Record<string, Uint8Array> = { [KEY]: FAKE }) {
	return {
		get: vi.fn(async (key: string) => {
			const bytes = objects[key];
			return bytes ? { size: bytes.byteLength, body: new Blob([bytes.slice()]).stream() } : null;
		}),
		head: vi.fn(async (key: string) => {
			const bytes = objects[key];
			return bytes ? { size: bytes.byteLength } : null;
		}),
		put: vi.fn(),
		delete: vi.fn()
	};
}

/** The env of a configured Hub. A null key means the provisioner's variable is absent entirely. */
function ready(bucket = stubBucket(), key: string | null = KEY): Record<string, unknown> {
	const env: Record<string, unknown> = { DOWNLOADS: bucket };
	return key === null ? env : { ...env, HARNESS_MAC_DOWNLOAD_KEY: key };
}

function eventFor(
	path: string,
	options: { method?: string; asset?: string; env?: Record<string, unknown> | null } = {}
): Parameters<typeof route.GET>[0] {
	const url = new URL(path, 'https://hub.example');
	const request = new Request(url, { method: options.method ?? 'GET' });
	const env = options.env === null ? undefined : (options.env ?? ready());
	return {
		request,
		url,
		params: { asset: options.asset ?? ARCHIVE },
		platform: env === undefined ? undefined : { env }
	} as unknown as Parameters<typeof route.GET>[0];
}

function expectNoStorage(bucket: ReturnType<typeof stubBucket>): void {
	expect(bucket.get).not.toHaveBeenCalled();
	expect(bucket.head).not.toHaveBeenCalled();
	expect(bucket.put).not.toHaveBeenCalled();
	expect(bucket.delete).not.toHaveBeenCalled();
}

async function expectOpaqueNotFound(response: Response): Promise<void> {
	expect(response.status).toBe(404);
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	const text = await response.text();
	// The body names no key, prefix, binding or archive: nothing that would reveal storage.
	expect(text).not.toMatch(/releases|mac-arm64|Harness\.zip|DOWNLOADS|HARNESS_|R2|key/i);
}

test('exports only GET and HEAD as methods, so no write method exists on the route', () => {
	const methods = Object.keys(route).filter((name) => /^[A-Z]+$/.test(name));
	expect(methods.sort()).toEqual(['GET', 'HEAD']);
	expect(route.trailingSlash).toBe('ignore');
});

test('GET streams the vetted archive with ZIP headers and no caching', () =>
	measureWorkload('hub.endpoint.download-mac', 'stream-archive', async () => {
		const bucket = stubBucket();
		const response = await route.GET(eventFor(PATH, { env: ready(bucket) }));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/zip');
		expect(response.headers.get('content-disposition')).toBe(
			'attachment; filename="Harness-mac-arm64.zip"'
		);
		expect(response.headers.get('content-length')).toBe(String(FAKE.byteLength));
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(FAKE);
		expect(bucket.get).toHaveBeenCalledTimes(1);
		expect(bucket.get).toHaveBeenCalledWith(KEY);
		expect(bucket.head).not.toHaveBeenCalled();
	}));

test('HEAD returns the same metadata and reads no bytes', async () => {
	const bucket = stubBucket();
	const response = await route.HEAD(eventFor(PATH, { method: 'HEAD', env: ready(bucket) }));
	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toBe('application/zip');
	expect(response.headers.get('content-length')).toBe(String(FAKE.byteLength));
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.text()).toBe('');
	expect(bucket.head).toHaveBeenCalledWith(KEY);
	expect(bucket.get).not.toHaveBeenCalled();
});

test.each([
	['no key configured', null],
	['an empty key', ''],
	['an uppercase digest', `releases/mac-arm64/${SHA.toUpperCase()}/Harness.zip`],
	['a short digest', `releases/mac-arm64/${SHA.slice(1)}/Harness.zip`],
	['another platform prefix', `releases/windows/${SHA}/Harness.zip`],
	['a traversal segment', `releases/mac-arm64/${SHA}/../Harness.zip`],
	['a trailing slash', `${KEY}/`]
])('%s is refused as an opaque 404 before any storage use', async (_label, key) => {
	const bucket = stubBucket();
	const env = ready(bucket, key);
	await expectOpaqueNotFound(await route.GET(eventFor(PATH, { env })));
	await expectOpaqueNotFound(await route.HEAD(eventFor(PATH, { method: 'HEAD', env })));
	expectNoStorage(bucket);
});

test('a missing binding or platform is an opaque 404 before any storage use', async () => {
	const bucket = stubBucket();
	await expectOpaqueNotFound(
		await route.GET(eventFor(PATH, { env: { HARNESS_MAC_DOWNLOAD_KEY: KEY } }))
	);
	await expectOpaqueNotFound(await route.GET(eventFor(PATH, { env: null })));
	expectNoStorage(bucket);
});

test('a missing object is an opaque 404 for GET and HEAD', async () => {
	const bucket = stubBucket({});
	await expectOpaqueNotFound(await route.GET(eventFor(PATH, { env: ready(bucket) })));
	await expectOpaqueNotFound(
		await route.HEAD(eventFor(PATH, { method: 'HEAD', env: ready(bucket) }))
	);
	expect(bucket.get).toHaveBeenCalledWith(KEY);
	expect(bucket.head).toHaveBeenCalledWith(KEY);
	expect(bucket.put).not.toHaveBeenCalled();
	expect(bucket.delete).not.toHaveBeenCalled();
});

test.each([
	['a case alias', 'harness-mac-arm64.zip'],
	['a suffixed name', `${ARCHIVE}.bak`],
	['a different platform', 'Harness-win-x64.zip'],
	['a bare stem', 'Harness-mac-arm64'],
	['an encoded slash', 'Harness-mac-arm64.zip%2Fx']
])('%s is an opaque 404 with no storage use', async (_label, asset) => {
	const bucket = stubBucket();
	const path = `/downloads/${asset}`;
	await expectOpaqueNotFound(await route.GET(eventFor(path, { asset, env: ready(bucket) })));
	expectNoStorage(bucket);
});

test('a trailing-slash alias of the vetted name is an opaque 404 with no storage use', async () => {
	const bucket = stubBucket();
	await expectOpaqueNotFound(
		await route.GET(eventFor(`${PATH}/`, { asset: ARCHIVE, env: ready(bucket) }))
	);
	expectNoStorage(bucket);
});

test.each([
	['a download flag', `${PATH}?download=1`],
	['a key the caller tries to supply', `${PATH}?key=${encodeURIComponent(KEY)}`]
])('%s is an opaque 404 with no storage use', async (_label, path) => {
	const bucket = stubBucket();
	await expectOpaqueNotFound(await route.GET(eventFor(path, { env: ready(bucket) })));
	await expectOpaqueNotFound(
		await route.HEAD(eventFor(path, { method: 'HEAD', env: ready(bucket) }))
	);
	expectNoStorage(bucket);
});

test('the built router serves the archive; the compiled route ignores trailing slashes', async () => {
	const bucket = stubBucket();
	const response = await viaRouter(PATH, 'GET', ready(bucket));
	expect([response.status, response.headers.get('content-type')]).toEqual([200, 'application/zip']);
	expect(new Uint8Array(await response.arrayBuffer())).toEqual(FAKE);
	const endpoint = 'output/server/entries/endpoints/downloads/_asset_/_server.ts.js';
	expect(((await load(endpoint)) as { trailingSlash?: string }).trailingSlash).toBe('ignore');
});

test.each([
	['a trailing slash', `${PATH}/`],
	['a nonempty query', `${PATH}?download=1`],
	['a case alias', '/downloads/harness-mac-arm64.zip']
])('%s is a 404 from the built router, not a redirect', async (_label, path) => {
	const bucket = stubBucket();
	for (const method of ['GET', 'HEAD']) {
		const response = await viaRouter(path, method, ready(bucket));
		expect([response.status, response.headers.get('location')]).toEqual([404, null]);
		expect(response.headers.get('cache-control')).toContain('no-store');
		expect(await response.text()).not.toMatch(/releases|mac-arm64|Harness\.zip|DOWNLOADS|key/i);
	}
	expectNoStorage(bucket);
});
