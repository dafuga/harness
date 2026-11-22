import { resolve } from 'node:path';
import { afterAll, beforeAll, test } from 'vitest';
import { expect } from '../verificationExpect';
import type { ComponentManifest } from '../../src/core/unitTypes';
import {
	RuntimeServerService,
	type ServedRuntime
} from '../../src/cli/program/run-kernel/RuntimeServerService';
import { UnitRuntimeService } from '../../src/services/execution-runtimes/UnitRuntimeService';
import { kernelArtifacts } from '../../src/utils/kernelArtifacts';
import { ComponentManifestValidator } from '../../src/validators/ComponentManifestValidator';
import { indexFiles, unitOf } from '../support/memoryTree';

const root = resolve('.');
const artifacts = kernelArtifacts();
const service = new UnitRuntimeService(root);
const expected = { ok: true, output: { contract: 'impact-kernel/1' } };
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

test('the module target answers the version call through the module adapter', async () => {
	const runtime = service.forUnit(manifest, 'module');
	expect(runtime.kind).toBe('module');
	expect(await runtime.invoke({ operation: 'version' })).toEqual(expected);
	expect(service.forUnit(manifest).kind).toBe('module');
	await runtime.close();
});

test('the wasm target answers the version call through the Wasm adapter', async () => {
	const runtime = service.forUnit(manifest, 'wasm');
	expect(runtime.kind).toBe('wasm');
	expect(await runtime.invoke({ operation: 'version' })).toEqual(expected);
	await runtime.close();
	const kernel = service.kernel('wasm');
	expect(kernel.kind).toBe('wasm');
	expect(await kernel.invoke({ operation: 'version' })).toEqual(expected);
	await kernel.close();
});

test('the process target answers the version call through the persistent process adapter', async () => {
	const runtime = service.forUnit(manifest, 'process');
	expect(runtime.kind).toBe('process');
	expect(await runtime.invoke({ operation: 'version' })).toEqual(expected);
	await runtime.close();
	const kernel = service.kernel('process');
	expect(kernel.kind).toBe('process');
	expect(await kernel.invoke({ operation: 'version' })).toEqual(expected);
	await kernel.close();
});

test('the http target answers the version call through the served module kernel', async () => {
	const runtime = service.forUnit(manifest, 'http');
	expect(runtime.kind).toBe('http');
	expect(await runtime.invoke({ operation: 'version' })).toEqual(expected);
	await runtime.close();
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
