import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { HttpRuntimeAdapter } from '../../src/adapters/HttpRuntimeAdapter';
import { ModuleRuntimeAdapter } from '../../src/adapters/ModuleRuntimeAdapter';
import { ProcessRuntimeAdapter } from '../../src/adapters/ProcessRuntimeAdapter';
import { WasmRuntimeAdapter } from '../../src/adapters/WasmRuntimeAdapter';
import type { RuntimeResponse } from '../../src/core/runtimeTypes';
import { fixtureServer, ok, scripted, scripts } from '../support/runtimeFixtures';

const request = { operation: 'version' };
const code = (response: RuntimeResponse) => (response.ok ? 'ok' : response.error.code);

test('process runtime reports malformed output, crashes, timeouts and missing binaries', async () => {
	const run = (script: string, timeoutMs = 5000) =>
		new ProcessRuntimeAdapter({ ...scripted(script), timeoutMs }).invoke(request);
	expect(await run(scripts.echo)).toEqual(JSON.parse(ok));
	expect(code(await run(scripts.garbage))).toBe('invalid-response');
	expect(code(await run(scripts.shape))).toBe('invalid-response');
	const crash = await run(scripts.crash);
	expect(crash).toEqual({
		ok: false,
		error: { code: 'runtime-failed', message: 'process exited with code 3: boom' }
	});
	const started = Date.now();
	expect(code(await run(scripts.hang, 300))).toBe('runtime-timeout');
	expect(Date.now() - started).toBeLessThan(3000);
	const missing = new ProcessRuntimeAdapter({ command: '/nonexistent/harness-unit' });
	expect(code(await missing.invoke(request))).toBe('runtime-unavailable');
}, 30_000);

test('persistent process runtime keeps one process, and recovers after a timeout', async () => {
	const persistent = new ProcessRuntimeAdapter({
		...scripted(scripts.lines),
		persistent: true,
		timeoutMs: 400
	});
	const first = (await persistent.invoke({ operation: 'a' })) as { output: { pid: number } };
	const second = (await persistent.invoke({ operation: 'b' })) as { output: { pid: number } };
	expect(second.output.pid).toBe(first.output.pid);
	expect(code(await persistent.invoke({ operation: 'garbage' }))).toBe('invalid-response');
	expect(code(await persistent.invoke({ operation: 'hang' }))).toBe('runtime-timeout');
	const third = (await persistent.invoke({ operation: 'c' })) as { output: { pid: number } };
	expect(third).toMatchObject({ ok: true, output: { pid: expect.any(Number) } });
	expect(third.output.pid).not.toBe(first.output.pid);
	await persistent.close();
}, 30_000);

test('HTTP runtime reports bad status, malformed bodies, timeouts and refused connections', async () => {
	const server = await fixtureServer({
		'/ok': { status: 200, body: ok },
		'/refused': {
			status: 400,
			body: '{"ok":false,"error":{"code":"invalid-request","message":"no"}}'
		},
		'/error': { status: 500, body: 'exploded' },
		'/garbage': { status: 200, body: '<html>' },
		'/hang': 'hang'
	});
	const call = (path: string) =>
		new HttpRuntimeAdapter(server.url + path, { timeoutMs: 300 }).invoke(request);
	expect(await call('/ok')).toEqual(JSON.parse(ok));
	expect(code(await call('/refused'))).toBe('invalid-request');
	expect(await call('/error')).toEqual({
		ok: false,
		error: { code: 'runtime-failed', message: 'HTTP 500: exploded' }
	});
	expect(code(await call('/garbage'))).toBe('invalid-response');
	expect(code(await call('/hang'))).toBe('runtime-timeout');
	await server.close();
	expect(code(await call('/ok'))).toBe('runtime-unavailable');
}, 30_000);

test('Wasm runtime reports missing files and modules without the JSON ABI', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-wasm-'));
	const bare = join(directory, 'bare.wasm');
	await writeFile(bare, Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
	await writeFile(join(directory, 'broken.wasm'), 'not wasm');
	const missing = await new WasmRuntimeAdapter(join(directory, 'absent.wasm')).invoke(request);
	const withoutAbi = await new WasmRuntimeAdapter(bare).invoke(request);
	const broken = await new WasmRuntimeAdapter(join(directory, 'broken.wasm')).invoke(request);
	expect(code(missing)).toBe('runtime-unavailable');
	expect(withoutAbi).toEqual({
		ok: false,
		error: {
			code: 'runtime-unavailable',
			message:
				'Wasm module does not export the Harness JSON ABI (memory, harness_alloc, harness_free, harness_invoke)'
		}
	});
	expect(code(broken)).toBe('runtime-unavailable');
});

test('module runtime reports thrown errors, malformed results and slow handlers', async () => {
	const call = (handler: ConstructorParameters<typeof ModuleRuntimeAdapter>[0]) =>
		new ModuleRuntimeAdapter(handler, { timeoutMs: 200 }).invoke(request);
	expect(await call(() => JSON.parse(ok) as RuntimeResponse)).toEqual(JSON.parse(ok));
	expect(
		await call(() => {
			throw new Error('nope');
		})
	).toEqual({ ok: false, error: { code: 'runtime-failed', message: 'nope' } });
	expect(code(await call(() => ({ ok: 'yes' }) as unknown as RuntimeResponse))).toBe(
		'invalid-response'
	);
	expect(code(await call(() => new Promise<RuntimeResponse>(() => undefined)))).toBe(
		'runtime-timeout'
	);
});
