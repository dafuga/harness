import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import { test } from 'vitest';
import { wasmAdapter } from '../../src/audit/development-tooling/adapters/wasm';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

type ArtifactExample = {
	name: string;
	relativePath: string;
	extension: '.abi' | '.wasm';
	contents: string;
	companion?: { extension: '.cpp'; contents: string };
	expected: ReturnType<typeof wasmAdapter.audit>;
};

const limits: AuditFile['limits'] = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 6,
	maxComplexity: 12,
	maxClassesPerFile: 1
};

const examples: ArtifactExample[] = [
	{
		name: 'contract WASM paired with C++ source',
		relativePath: 'contracts/auction.wasm',
		extension: '.wasm',
		contents: 'WASM fixture',
		companion: { extension: '.cpp', contents: 'int auction() { return 1; }' },
		expected: []
	},
	{
		name: 'unpaired WASM outside artifact directories',
		relativePath: 'src/auction.wasm',
		extension: '.wasm',
		contents: 'WASM fixture',
		expected: [
			{
				path: 'src/auction.wasm',
				rule: 'wasm-artifact-placement',
				message: 'WASM and ABI artifacts should live under an artifact or contract directory.'
			},
			{
				path: 'src/auction.wasm',
				rule: 'wasm-source-pairing',
				message: 'WASM artifacts should be paired with source or ABI metadata.'
			}
		]
	},
	{
		name: 'malformed ABI outside artifact directories',
		relativePath: 'src/abi/auction.abi',
		extension: '.abi',
		contents: '{ "name": ',
		expected: [
			{
				path: 'src/abi/auction.abi',
				rule: 'wasm-artifact-placement',
				message: 'WASM and ABI artifacts should live under an artifact or contract directory.'
			},
			{
				path: 'src/abi/auction.abi',
				rule: 'wasm-abi-json',
				message: 'ABI artifacts should be valid JSON.'
			}
		]
	},
	{
		name: 'valid ABI under the wasm directory',
		relativePath: 'wasm/auction.abi',
		extension: '.abi',
		contents: '{"name":"auction","type":"function"}',
		expected: []
	}
];

async function auditExample(root: string, example: ArtifactExample) {
	const absolutePath = join(root, ...example.relativePath.split('/'));
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, example.contents);
	if (example.companion) {
		await writeFile(
			join(dirname(absolutePath), `${parse(absolutePath).name}${example.companion.extension}`),
			example.companion.contents
		);
	}
	const file: AuditFile = {
		absolutePath,
		relativePath: example.relativePath,
		extension: example.extension,
		contents: example.contents,
		lines: example.contents.split('\n'),
		structuralLines: example.contents.split('\n'),
		limits,
		size: Buffer.byteLength(example.contents)
	};
	return wasmAdapter.audit(file);
}

test('Audits WASM and ABI artifact rules in order', async () => {
	const observations = await withTempDir('wasm-adapter-examples-', async (directory) =>
		Promise.all(
			examples.map(async (example) => ({
				example,
				output: await auditExample(directory, example)
			}))
		)
	);
	expect({
		id: wasmAdapter.id,
		label: wasmAdapter.label,
		profiles: wasmAdapter.profiles,
		extensions: wasmAdapter.extensions,
		optionalTools: wasmAdapter.optionalTools
	}).toEqual({
		id: 'wasm',
		label: 'WASM artifacts',
		profiles: ['dapp', 'lib'],
		extensions: ['.abi', '.wasm'],
		optionalTools: []
	});
	expect(observations.map(({ output }) => output)).toEqual(
		examples.map(({ expected }) => expected)
	);
	recordExampleCases(
		{
			unitId: 'audit.adapters-wasm',
			symbol: 'wasmAdapter.audit',
			state: 'audits-wasm-and-abi-artifact-rules-in-order',
			evidence: 'examples-cases',
			file: 'audits-wasm-and-abi-artifact-rules-in-order.json'
		},
		observations.map(({ example, output }) => ({
			name: example.name,
			input: {
				relativePath: example.relativePath,
				extension: example.extension,
				contents: example.contents,
				companion: example.companion ?? null
			},
			output
		}))
	);
});
