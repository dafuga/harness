import { afterAll, beforeAll, expect, test } from 'vitest';
import type { RuntimeRequest, UnitRuntime } from '../../src/core/runtimeTypes';
import { HttpRuntimeAdapter } from '../../src/adapters/HttpRuntimeAdapter';
import { ProcessRuntimeAdapter } from '../../src/adapters/process-runtime-adapter/ProcessRuntimeAdapter';
import { WasmRuntimeAdapter } from '../../src/adapters/WasmRuntimeAdapter';
import { RuntimeServerService, type ServedRuntime } from '../../src/services/RuntimeServerService';
import { UnitRuntimeService } from '../../src/services/UnitRuntimeService';
import { impactKernel } from '../../src/utils/impact-kernel/impactKernel';
import { kernelArtifacts } from '../../src/utils/kernelArtifacts';
import { kernelMutations } from '../../src/workflows/run-kernel/kernelWorkload';
import { kernelWorkload } from '../../src/utils/kernelWorkload';
import { recordCapture } from '../../src/utils/record-capture/recordCapture';
import { kernelVectors, vectorText } from '../support/kernelVectors';

const artifacts = kernelArtifacts();
const service = new UnitRuntimeService();
let runtimes: Record<string, UnitRuntime>;
let served: ServedRuntime;

beforeAll(async () => {
	expect(artifacts.wasm, 'run bun run build:kernel').toBeDefined();
	expect(artifacts.native, 'run bun run build:kernel').toBeDefined();
	served = await new RuntimeServerService().serve(service.kernel('wasm'), { port: 0 });
	runtimes = {
		module: service.kernel('module'),
		wasm: service.kernel('wasm'),
		process: service.kernel('process'),
		lines: new ProcessRuntimeAdapter({
			command: artifacts.native ?? '',
			args: ['--lines'],
			persistent: true
		}),
		http: new HttpRuntimeAdapter(served.url)
	};
});

afterAll(async () => {
	await Promise.all(Object.values(runtimes).map((runtime) => runtime.close()));
	await served.close();
});

test('every runtime satisfies every structured vector', async () => {
	for (const vector of kernelVectors.filter((item) => item.request !== undefined)) {
		for (const [name, runtime] of Object.entries(runtimes)) {
			const response = await runtime.invoke(vector.request as RuntimeRequest);
			expect(response, `${name}: ${vector.name}`).toEqual(vector.response);
		}
	}
}, 60_000);

test('byte transports satisfy the raw text vectors, including text that is not JSON', async () => {
	const wasm = new WasmRuntimeAdapter(artifacts.wasm ?? '');
	const native = new ProcessRuntimeAdapter({ command: artifacts.native ?? '' });
	for (const vector of kernelVectors) {
		const text = vectorText(vector);
		const posted = await fetch(served.url, { method: 'POST', body: text });
		expect(JSON.parse(await wasm.invokeText(text)), `wasm: ${vector.name}`).toEqual(
			vector.response
		);
		expect(JSON.parse(await native.invokeText(text)), `native: ${vector.name}`).toEqual(
			vector.response
		);
		expect(await posted.json(), `http: ${vector.name}`).toEqual(vector.response);
	}
}, 60_000);

test('seeded graphs produce identical output in the reference, Wasm and native runtimes', async () => {
	const sizes = [0, 1, 2, 3, 17, 120, 900];
	for (const nodes of sizes) {
		for (const seed of [11, 12, 13]) {
			const request = kernelWorkload(nodes, seed);
			const expected = impactKernel(request);
			expect(expected.ok).toBe(true);
			expect(await runtimes.wasm.invoke(request), `wasm ${nodes}/${seed}`).toEqual(expected);
			expect(await runtimes.lines.invoke(request), `native ${nodes}/${seed}`).toEqual(expected);
		}
	}
	const request = kernelWorkload(900, 14);
	expect(await runtimes.process.invoke(request)).toEqual(impactKernel(request));
	expect(await runtimes.http.invoke(request)).toEqual(impactKernel(request));
}, 60_000);

test('seeded malformed requests are refused identically by every implementation', async () => {
	const mutations = kernelMutations(kernelWorkload(30, 21), 60);
	expect(mutations.length).toBe(60);
	const codes = new Set<string>();
	for (const [index, request] of mutations.entries()) {
		const expected = impactKernel(request);
		if (!expected.ok) codes.add(expected.error.code);
		const text = JSON.stringify(request);
		expect(await runtimes.wasm.invoke(request as RuntimeRequest), `wasm ${index} ${text}`).toEqual(
			expected
		);
		expect(await runtimes.lines.invoke(request as RuntimeRequest), `native ${index}`).toEqual(
			expected
		);
	}
	expect([...codes].sort()).toEqual(['invalid-graph', 'invalid-request', 'unknown-operation']);
}, 60_000);

test('under verification the comparison is recorded as evidence for each built kernel', () => {
	// The tests above compared every case; a verification rejects this evidence if one failed.
	const compared = {
		contract: 'impact-kernel/1',
		reference: 'TypeScript reference kernel',
		vectors: kernelVectors.length,
		seededGraphs: 7 * 3,
		expectation: 'every response equal to the reference'
	};
	const states = { native: artifacts.native, wasm: artifacts.wasm };
	for (const [state, artifact] of Object.entries(states)) {
		expect(artifact, state).toBeDefined();
		recordCapture(
			{
				evidence: 'parity',
				kind: 'assertions',
				state,
				file: `parity-${state}.json`,
				mediaType: 'application/json'
			},
			JSON.stringify({ ...compared, runtime: state }, null, 2)
		);
	}
});
