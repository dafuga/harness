import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { HttpRuntimeAdapter } from '../src/adapters/HttpRuntimeAdapter';
import { ModuleRuntimeAdapter } from '../src/adapters/ModuleRuntimeAdapter';
import { RuntimeServerService, type ServedRuntime } from '../src/services/RuntimeServerService';
import { impactKernel } from '../src/utils/impact-kernel/impactKernel';
import { runCommand } from './support/cli';
import { kernelVectors } from './support/kernelVectors';
import { startWorker, type LocalWorker } from './support/workers';

/** A Worker that uses only the packed package: its edge entry and its precompiled kernel. */
const worker = `
import {
	HandlerRuntimeAdapter,
	HttpRuntimeAdapter,
	WasmModuleRuntimeAdapter,
	runtimeFetch,
	type RuntimeRequest,
	type UnitRuntime
} from '@dafuga01/harness/edge';
import kernel from '@dafuga01/harness/kernel.wasm';

const handler = new HandlerRuntimeAdapter((request) => ({
	ok: true,
	output: { echoed: request.input ?? null }
}));
const wasm = new WasmModuleRuntimeAdapter(kernel);
const emptyModule = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const serveUnit = runtimeFetch(wasm);

function target(name: string, upstream: string): UnitRuntime | undefined {
	if (name === 'module') return handler;
	if (name === 'wasm') return wasm;
	if (name === 'http') return new HttpRuntimeAdapter(upstream);
	// Bytes cannot be compiled inside a Worker; only a precompiled module may be handed in.
	return name === 'bytes' ? new WasmModuleRuntimeAdapter(emptyModule) : undefined;
}

export default {
	async fetch(request: Request, env: { UPSTREAM: string }): Promise<Response> {
		const name = new URL(request.url).pathname.slice(1);
		if (name === 'unit') return serveUnit(request);
		const runtime = target(name, env.UPSTREAM);
		if (!runtime) return new Response('unknown target', { status: 404 });
		const call = (await request.json()) as RuntimeRequest;
		const response = await runtime.invoke(call);
		return Response.json({ kind: runtime.kind, response, agent: navigator.userAgent });
	}
};
`;
const shim =
	"declare module '*.wasm' {\n\tconst module: WebAssembly.Module;\n\texport default module;\n}\n";
const tsconfig = {
	compilerOptions: {
		target: 'ES2022',
		module: 'ESNext',
		moduleResolution: 'Bundler',
		lib: ['ES2022', 'WebWorker'],
		// No Node types: the edge entry must type-check against the web platform alone.
		types: [],
		strict: true,
		noEmit: true,
		skipLibCheck: false
	},
	include: ['worker.ts', 'wasm.d.ts']
};

let root: string;
let project: string;
let upstream: ServedRuntime;
let local: LocalWorker;

async function call(name: string, request: unknown) {
	const response = await fetch(`${local.url}/${name}`, {
		method: 'POST',
		body: JSON.stringify(request)
	});
	return (await response.json()) as { kind: string; response: unknown; agent: string };
}

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-edge-'));
	const tarball = join(root, 'harness.tgz');
	await runCommand(['bun', 'pm', 'pack', '--ignore-scripts', '--filename', tarball], process.cwd());
	project = join(root, 'consumer');
	await mkdir(project);
	const manifest = { name: 'edge-consumer', private: true, type: 'module' };
	const dependencies = { '@dafuga01/harness': `file:${tarball}` };
	await writeFile(join(project, 'package.json'), JSON.stringify({ ...manifest, dependencies }));
	await writeFile(join(project, 'tsconfig.json'), JSON.stringify(tsconfig));
	await writeFile(join(project, 'worker.ts'), worker);
	await writeFile(join(project, 'wasm.d.ts'), shim);
	// Deliberately no nodejs_compat flag: the edge entry may not need any Node API.
	await writeFile(
		join(project, 'wrangler.toml'),
		'name = "harness-edge-consumer"\nmain = "worker.ts"\ncompatibility_date = "2025-09-01"\n'
	);
	await runCommand(['bun', 'install'], project);
	upstream = await new RuntimeServerService().serve(new ModuleRuntimeAdapter(impactKernel), {
		port: 0
	});
	local = await startWorker(project, ({ port, inspector }) => [
		'dev',
		'--ip',
		'127.0.0.1',
		'--port',
		String(port),
		'--inspector-port',
		String(inspector),
		'--var',
		`UPSTREAM:${upstream.url}`
	]);
}, 300_000);
afterAll(async () => {
	await local?.stop();
	await upstream?.close();
	await rm(root, { recursive: true, force: true });
});

test('the packed edge entry type-checks against the web platform without Node types', async () => {
	const tsc = resolve('node_modules/.bin/tsc');
	const checked = await runCommand([tsc, '-p', '.'], project, false);
	expect(checked.stdout + checked.stderr).toBe('');
	expect(checked.exitCode).toBe(0);
});

test('a handler runs inside workerd through the packed edge entry', async () => {
	const result = await call('module', { operation: 'echo', input: { size: 3 } });
	expect(result).toEqual({
		kind: 'module',
		response: { ok: true, output: { echoed: { size: 3 } } },
		agent: 'Cloudflare-Workers'
	});
});

test('the precompiled Rust kernel answers every contract vector inside workerd', async () => {
	const vectors = kernelVectors.filter((vector) => vector.request !== undefined);
	expect(vectors.length).toBeGreaterThan(5);
	for (const vector of vectors) {
		const result = await call('wasm', vector.request);
		expect([vector.name, result.kind, result.agent]).toEqual([
			vector.name,
			'wasm',
			'Cloudflare-Workers'
		]);
		expect(result.response, vector.name).toEqual(vector.response);
	}
});

test('a Worker calls a unit over HTTP, and serves one with the same wire contract', async () => {
	const request = { operation: 'version' };
	const expected = { ok: true, output: { contract: 'impact-kernel/1' } };
	expect(await call('http', request)).toEqual({
		kind: 'http',
		response: expected,
		agent: 'Cloudflare-Workers'
	});
	// From Node, the unit the Worker serves is one more HTTP target.
	const served = new HttpRuntimeAdapter(`${local.url}/unit`);
	expect(await served.invoke(request)).toEqual(expected);
	const refused = await fetch(`${local.url}/unit`);
	expect(refused.status).toBe(405);
	expect(await refused.json()).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
});

test('Workers refuse to compile bytes, so a unit must be handed in precompiled', async () => {
	const result = await call('bytes', { operation: 'version' });
	expect(result.agent).toBe('Cloudflare-Workers');
	expect(result.response).toMatchObject({ ok: false, error: { code: 'runtime-unavailable' } });
});
