import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { ModuleRuntimeAdapter } from '../../src/adapters/execution-runtimes/ModuleRuntimeAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Invokes the exported handler with runtime requests', async () => {
	await withTempDir('module-runtime-examples-', async (directory) => {
		const file = join(directory, 'impact-kernel.mjs');
		await writeFile(
			file,
			'export function invoke(request) { return { ok: true, output: { operation: request.operation, input: request.input ?? null } }; }\n'
		);
		const runtime = ModuleRuntimeAdapter.load(file, 'invoke', {
			timeoutMs: 5000,
			label: 'impact kernel fixture'
		});
		const requests = [
			{ operation: 'render', input: { component: 'Button', props: { label: 'Save' } } },
			{ operation: 'inspect', input: { file: 'src/Action.ts' } }
		];
		const outputs = await Promise.all(requests.map((request) => runtime.invoke(request)));

		expect(runtime.kind).toBe('module');
		expect(outputs).toEqual(
			requests.map((request) => ({
				ok: true,
				output: { operation: request.operation, input: request.input }
			}))
		);
		recordExampleCases(
			{
				unitId: 'adapter.module-runtime',
				symbol: 'ModuleRuntimeAdapter.invoke',
				state: 'invokes-the-exported-handler-with-runtime-requests',
				evidence: 'examples-cases',
				file: 'invokes-the-exported-handler-with-runtime-requests.json'
			},
			requests.map((input, index) => ({
				name: `${input.operation} request reaches the exported handler`,
				input,
				output: outputs[index]
			}))
		);
	});
});

test('Reports a missing handler export as unavailable', async () => {
	await withTempDir('module-runtime-examples-', async (directory) => {
		const file = join(directory, 'metadata-only.mjs');
		await writeFile(file, "export const version = '1.0';\n");
		const runtime = ModuleRuntimeAdapter.load(file, 'invoke', {
			label: 'impact kernel fixture'
		});
		const requests = [
			{ operation: 'render', input: { component: 'Button' } },
			{ operation: 'inspect', input: { file: 'src/Action.ts' } }
		];
		const outputs = await Promise.all(requests.map((request) => runtime.invoke(request)));
		const unavailable = {
			ok: false,
			error: {
				code: 'runtime-unavailable',
				message: 'impact kernel fixture does not export a function named invoke'
			}
		};

		expect(outputs).toEqual([unavailable, unavailable]);
		recordExampleCases(
			{
				unitId: 'adapter.module-runtime',
				symbol: 'ModuleRuntimeAdapter.invoke',
				state: 'reports-a-missing-handler-export-as-unavailable',
				evidence: 'examples-cases',
				file: 'reports-a-missing-handler-export-as-unavailable.json'
			},
			requests.map((input, index) => ({
				name: `${input.operation} request with no invoke export`,
				input,
				output: outputs[index]
			}))
		);
	});
});

test('Keeps a failed module import cached', async () => {
	await withTempDir('module-runtime-examples-', async (directory) => {
		const file = join(directory, 'appears-after-first-call.mjs');
		const runtime = ModuleRuntimeAdapter.load(file, 'invoke', {
			label: 'impact kernel fixture'
		});
		const request = { operation: 'render', input: { component: 'Button' } };
		const first = await runtime.invoke(request);
		await writeFile(
			file,
			'export function invoke(request) { return { ok: true, output: request.input }; }\n'
		);
		const second = await runtime.invoke(request);
		const unavailable = {
			ok: false,
			error: {
				code: 'runtime-unavailable',
				message: 'impact kernel fixture does not export a function named invoke'
			}
		};

		expect(first).toEqual(unavailable);
		expect(second).toEqual(unavailable);
		recordExampleCases(
			{
				unitId: 'adapter.module-runtime',
				symbol: 'ModuleRuntimeAdapter.invoke',
				state: 'keeps-a-failed-module-import-cached',
				evidence: 'examples-cases',
				file: 'keeps-a-failed-module-import-cached.json'
			},
			[
				{ name: 'first call cannot import the file', input: request, output: first },
				{ name: 'later file creation does not retry the import', input: request, output: second }
			]
		);
	});
});
