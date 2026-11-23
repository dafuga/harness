import type { Call } from './entry.picker.test.types';
import { test, vi } from 'vitest';
import type * as NodeFs from 'node:fs/promises';
import type * as NodePath from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';

// src/cli/picker.ts has no exports and runs at import time, with import.meta.dir
// (absent under vitest). Its collaborators are replaced by recording stand-ins so
// no home folder, provider catalog, stdio transport or network is touched.
const recorder = vi.hoisted(() => {
	const calls: Call[] = [];
	const make = (name: string) =>
		class {
			readonly label = name;
			constructor(...args: unknown[]) {
				calls.push({ name, args });
			}
			connect(): Promise<void> {
				calls.push({ name: `${name}.connect`, args: [] });
				return Promise.resolve();
			}
		};
	return { calls, make };
});

vi.mock('../../src/cli/program/codex-picker-command/pickerPaths', () => ({
	pickerPaths: () => ({ home: 'made-up-home', catalogs: 'made-up-catalogs' })
}));
vi.mock('../../src/repositories/agents-providers/ProviderSwitchRepository', () => ({
	ProviderSwitchRepository: recorder.make('ProviderSwitchRepository')
}));
vi.mock('../../src/adapters/agents-providers/ProviderCatalogAdapter', () => ({
	ProviderCatalogAdapter: recorder.make('ProviderCatalogAdapter')
}));
vi.mock('../../src/services/agents-providers/ProviderSwitchService', () => ({
	ProviderSwitchService: recorder.make('ProviderSwitchService')
}));
vi.mock('../../src/services/agents-providers/CodexPickerMcpService', () => ({
	CodexPickerMcpService: recorder.make('CodexPickerMcpService')
}));
vi.mock('node:fs/promises', async (importOriginal) => ({
	...(await importOriginal<typeof NodeFs>()),
	readFile: async (path: string) => {
		recorder.calls.push({ name: 'readFile', args: [path] });
		return '<main>made-up panel</main>';
	}
}));
vi.mock('node:path', async (importOriginal) => {
	const actual = await importOriginal<typeof NodePath>();
	return {
		...actual,
		join: (...parts: unknown[]) =>
			actual.join(...parts.map((part) => (typeof part === 'string' ? part : '')))
	};
});

function plain(value: unknown): unknown {
	if (typeof value === 'object' && value !== null && 'label' in value) return value.label;
	return value;
}

function summarise(calls: Call[]): Array<{ name: string; args: unknown[] }> {
	return calls.map((call) => ({ name: call.name, args: call.args.map(plain) }));
}

test('Wires the picker service and connects the MCP panel', async () => {
	recorder.calls.length = 0;
	await import('../../src/cli/picker');
	const actual = summarise(recorder.calls);
	const expected = [
		{ name: 'ProviderSwitchRepository', args: ['made-up-home'] },
		{ name: 'ProviderCatalogAdapter', args: ['made-up-catalogs'] },
		{ name: 'ProviderSwitchService', args: ['ProviderSwitchRepository', 'ProviderCatalogAdapter'] },
		{ name: 'readFile', args: ['panel.html'] },
		{
			name: 'CodexPickerMcpService',
			args: ['ProviderSwitchService', '<main>made-up panel</main>']
		},
		{ name: 'CodexPickerMcpService.connect', args: [] }
	];
	expect(actual).toEqual(expected);

	recordExampleCases(
		{
			unitId: 'entry.picker',
			symbol: 'module',
			state: 'wires-the-picker-service-and-connects-the-mcp-panel',
			evidence: 'examples-cases',
			file: 'wires-the-picker-service-and-connects-the-mcp-panel.json'
		},
		[
			{
				name: 'import wires the service and connects the panel',
				input: 'module import',
				output: actual
			}
		]
	);
});
