import { test } from 'vitest';
import type { ImpactSide } from '../../src/core/development-tooling/impactTypes';
import type { ImpactInput } from '../../src/core/execution-runtimes/kernelTypes';
import type { RuntimeRequest, UnitRuntime } from '../../src/core/execution-runtimes/runtimeTypes';
import { ImpactService } from '../../src/services/reports-media/impact-service/ImpactService';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const FILE = 'src/services/impact-service/ImpactService.ts';
const BASE = '0123456789abcdef0123456789abcdef01234567';
const BASE_HASH = '02e92c9cc7f48e6d6f899552efe6f507774a286e';
const HEAD_HASH = '7f3a1c0b9d2e4f5a6b7c8d9e0f1a2b3c4d5e6f70';

const config = {
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/', 'tests/'],
	global: [],
	ignored: ['**/*.md', 'specification/features/', 'specification/loops/', '.gitignore'],
	references: []
};

const okResponse = {
	ok: true,
	output: { affected: [], uncovered: [], unknown: [] }
};

function side(revision: string, hash: string): ImpactSide {
	return {
		revision,
		config,
		entries: [{ path: FILE, hash }],
		manifests: [],
		scenarios: [],
		graph: {
			nodes: [{ id: `file:${FILE}`, kind: 'source', unit: 'service.impact' }],
			edges: [],
			uncertain: []
		}
	} as ImpactSide;
}

function fakeRuntime(response: unknown) {
	const requests: RuntimeRequest[] = [];
	const runtime = {
		kind: 'module',
		invoke: (request: RuntimeRequest) => {
			requests.push(request);
			return Promise.resolve(response as Awaited<ReturnType<UnitRuntime['invoke']>>);
		},
		close: async () => undefined
	} as UnitRuntime;
	return { runtime, requests };
}

test('Computes an impact report for a modified source file', async () => {
	const { runtime, requests } = fakeRuntime(okResponse);
	const base = side(BASE, BASE_HASH);
	const head = side('working-tree', HEAD_HASH);
	const report = await new ImpactService(runtime).compute(base, head);
	const input = requests[0]?.input as ImpactInput;

	expect(requests).toHaveLength(1);
	expect(requests[0]?.operation).toBe('impact');
	expect(report.base).toBe(BASE);
	expect(report.head).toBe('working-tree');
	expect(report.runtime).toBe('module');
	expect(report.changed.map((file) => file.path)).toEqual([FILE]);
	expect(input.changed).toHaveLength(1);

	recordExampleCases(
		{
			unitId: 'service.impact',
			symbol: 'compute',
			state: 'computes-an-impact-report-for-a-modified-source-file',
			evidence: 'examples-cases',
			file: 'computes-an-impact-report-for-a-modified-source-file.json'
		},
		[
			{
				name: 'one modified source file produces one changed path',
				input: { base: { revision: BASE, hash: BASE_HASH }, head: { revision: 'working-tree', hash: HEAD_HASH } },
				output: {
					base: report.base,
					head: report.head,
					runtime: report.runtime,
					expanded: report.expanded,
					changed: report.changed.map((file) => file.path)
				}
			}
		]
	);
});

test('Rejects with the kernel failure code and message', async () => {
	const { runtime } = fakeRuntime({
		ok: false,
		error: { code: 'KERNEL_DOWN', message: 'kernel not loaded' }
	});
	let error: unknown;
	try {
		await new ImpactService(runtime).compute(side(BASE, BASE_HASH), side('working-tree', HEAD_HASH));
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	expect((error as Error).name).toBe('ExpectedCliError');
	expect((error as Error).message).toContain('KERNEL_DOWN');
	expect((error as Error).message).toContain('kernel not loaded');

	recordExampleCases(
		{
			unitId: 'service.impact',
			symbol: 'compute',
			state: 'rejects-with-the-kernel-failure-code-and-message',
			evidence: 'examples-cases',
			file: 'rejects-with-the-kernel-failure-code-and-message.json'
		},
		[
			{
				name: 'runtime ok false rejects with code and message',
				input: { code: 'KERNEL_DOWN', message: 'kernel not loaded' },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
