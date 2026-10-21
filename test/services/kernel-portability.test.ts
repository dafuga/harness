import { afterAll, beforeAll, expect, test } from 'vitest';
import { HttpRuntimeAdapter } from '../../src/adapters/HttpRuntimeAdapter';
import { ProcessRuntimeAdapter } from '../../src/adapters/process-runtime-adapter/ProcessRuntimeAdapter';
import type { RuntimeRequest, UnitRuntime } from '../../src/core/runtimeTypes';
import { RuntimeServerService, type ServedRuntime } from '../../src/services/RuntimeServerService';
import { UnitRuntimeService } from '../../src/services/UnitRuntimeService';
import { impactKernel } from '../../src/utils/impact-kernel/impactKernel';
import { impactKernelText } from '../../src/workflows/run-kernel/impactKernel';
import { kernelArtifacts } from '../../src/utils/kernelArtifacts';

const refused = {
	ok: false,
	error: { code: 'invalid-json', message: 'request is not valid JSON' }
};
const version = { ok: true, output: { contract: 'impact-kernel/1' } };
const graph = { nodes: ['a'], edges: [] as unknown[] };
const impact = (patch: Record<string, unknown>): unknown => ({
	operation: 'impact',
	input: { base: graph, head: graph, changed: [], uncertain: [], sinks: [], ...patch }
});
const nested = (levels: number): unknown =>
	Array.from({ length: levels }).reduce<unknown>((inner) => [inner], 0);

function cyclic(): unknown {
	const request: Record<string, unknown> = { operation: 'version' };
	request.self = request;
	return request;
}

const nonPortable: Array<[string, unknown]> = [
	['Infinity in an ignored field', { operation: 'version', ignored: Infinity }],
	['negative Infinity inside an array', { operation: 'version', ignored: [-Infinity] }],
	['NaN as a graph index', impact({ base: { nodes: ['a'], edges: [[0, NaN]] } })],
	['a bigint', { operation: 'version', ignored: 10n }],
	['a lone surrogate in a node id', impact({ changed: ['\ud800'] })],
	['a lone surrogate in a key', { operation: 'version', '\udc00': 1 }],
	['undefined inside an array', { operation: 'version', ignored: [undefined] }],
	['a function', { operation: 'version', ignored: () => 1 }],
	['nesting beyond 64 levels', { operation: 'version', deep: nested(64) }],
	['a cycle', cyclic()]
];
const portable: Array<[string, unknown]> = [
	[
		'an undefined property, which is the same as an absent one',
		{ operation: 'version', ignored: undefined }
	],
	['nesting of exactly 64 levels', { operation: 'version', deep: nested(63) }],
	['a surrogate pair', { operation: 'version', ignored: '😀' }],
	['the largest finite double', { operation: 'version', ignored: Number.MAX_VALUE }]
];

const service = new UnitRuntimeService();
let runtimes: Record<string, UnitRuntime>;
let served: ServedRuntime;

beforeAll(async () => {
	const native = kernelArtifacts().native ?? '';
	expect(native, 'run bun run build:kernel').not.toBe('');
	served = await new RuntimeServerService().serve(service.kernel('module'), { port: 0 });
	runtimes = {
		module: service.kernel('module'),
		wasm: service.kernel('wasm'),
		process: service.kernel('process'),
		lines: new ProcessRuntimeAdapter({ command: native, args: ['--lines'], persistent: true }),
		http: new HttpRuntimeAdapter(served.url)
	};
});

afterAll(async () => {
	await Promise.all(Object.values(runtimes).map((runtime) => runtime.close()));
	await served.close();
});

test('the reference refuses requests that are not portable JSON', () => {
	for (const [name, request] of nonPortable) expect(impactKernel(request), name).toEqual(refused);
	for (const [name, request] of portable) expect(impactKernel(request), name).toEqual(version);
});

test('every runtime refuses a structured request it could not carry faithfully', async () => {
	for (const [name, request] of nonPortable) {
		for (const [runtime, adapter] of Object.entries(runtimes)) {
			const response = await adapter.invoke(request as RuntimeRequest);
			expect(response, `${runtime}: ${name}`).toEqual(refused);
		}
	}
});

test('every runtime accepts the portable edge cases identically', async () => {
	for (const [name, request] of portable) {
		for (const [runtime, adapter] of Object.entries(runtimes)) {
			const response = await adapter.invoke(request as RuntimeRequest);
			expect(response, `${runtime}: ${name}`).toEqual(version);
		}
	}
});

test('a served unit refuses non-portable request text before it reaches the unit', async () => {
	for (const text of [
		'{"operation":"version","ignored":1e400}',
		'{"operation":"version","\\ud800":1}'
	]) {
		const response = await fetch(served.url, { method: 'POST', body: text });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual(refused);
		expect(JSON.parse(impactKernelText(text))).toEqual(refused);
	}
});
