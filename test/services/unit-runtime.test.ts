import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { RuntimeServerService, type ServedRuntime } from '../../src/services/RuntimeServerService';
import { UnitRuntimeService } from '../../src/services/UnitRuntimeService';
import { kernelArtifacts } from '../../src/utils/kernelArtifacts';
import { ComponentManifestValidator } from '../../src/validators/ComponentManifestValidator';
import { indexFiles, unitOf } from '../support/memoryTree';

const root = resolve('.');
const artifacts = kernelArtifacts();
const service = new UnitRuntimeService(root);
let served: ServedRuntime;
let manifest: ComponentManifest;

beforeAll(async () => {
	served = await new RuntimeServerService().serve(service.kernel('module'), { port: 0 });
	const source = { 'src/utils/impactKernel.ts': 'export function impactKernel(): void {}\n' };
	const derived = unitOf(await indexFiles(source), 'function.impact-kernel');
	const module = {
		kind: 'module' as const,
		entry: 'src/utils/impactKernel.ts',
		handler: 'impactKernel'
	};
	manifest = {
		...derived,
		runtime: {
			...module,
			targets: [
				module,
				{ kind: 'wasm', entry: artifacts.wasm ?? '' },
				{ kind: 'process', entry: artifacts.native ?? '' },
				{ kind: 'http', entry: served.url }
			]
		}
	};
});

afterAll(() => served.close());

test('a manifest with a handler and four targets is a valid unit', () => {
	expect(
		new ComponentManifestValidator().validate(manifest, 'function.impact-kernel.json').errors
	).toEqual([]);
});

test('each declared execution target selects a working adapter of that kind', async () => {
	const expected = { ok: true, output: { contract: 'impact-kernel/1' } };
	for (const kind of ['module', 'wasm', 'process', 'http'] as const) {
		const runtime = service.forUnit(manifest, kind);
		expect(runtime.kind).toBe(kind);
		expect(await runtime.invoke({ operation: 'version' }), kind).toEqual(expected);
		await runtime.close();
	}
	const byDefault = service.forUnit(manifest);
	expect(byDefault.kind).toBe('module');
	expect(await byDefault.invoke({ operation: 'version' })).toEqual(expected);
});

test('an undeclared target is refused instead of guessed', async () => {
	const moduleOnly = {
		...manifest,
		runtime: { ...manifest.runtime, targets: [manifest.runtime.targets[0]] }
	};
	expect(() => service.forUnit(moduleOnly, 'wasm')).toThrow(
		'function.impact-kernel does not declare a wasm execution target'
	);
	const noHandler = {
		kind: 'module' as const,
		entry: 'src/utils/impactKernel.ts',
		handler: 'absent'
	};
	const response = await service.forTarget(noHandler).invoke({ operation: 'version' });
	expect(response).toEqual({
		ok: false,
		error: {
			code: 'runtime-unavailable',
			message: 'src/utils/impactKernel.ts does not export a function named absent'
		}
	});
});

test('the kernel default follows recorded measurements and http needs a served unit', () => {
	expect(['module', 'wasm', 'process']).toContain(service.kernel().kind);
	expect(() => new UnitRuntimeService(root, { env: {} }).kernel('http')).toThrow(
		'HARNESS_KERNEL_URL'
	);
	expect(
		new UnitRuntimeService(root, { env: { HARNESS_KERNEL_URL: served.url } }).kernel('http').kind
	).toBe('http');
});
