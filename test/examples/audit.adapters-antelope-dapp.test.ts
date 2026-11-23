import { test } from 'vitest';
import { antelopeDappAdapter } from '../../src/audit/development-tooling/adapters/antelopeDapp';
import type { AuditFile, AuditStructure } from '../../src/audit/development-tooling/adapters/types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const adapterMetadata = {
	id: 'antelope-dapp',
	label: 'Antelope and Harbor dApps',
	profiles: ['dapp'],
	extensions: [],
	optionalTools: ['antelope-cli', 'cdt-cpp']
};

const structureExamples: Array<{
	name: string;
	input: AuditStructure;
	expected: Array<{ path: string; rule: string }>;
}> = [
	{
		name: 'reports absent build tooling and contract files plus both misplaced Ricardian documents',
		input: {
			profile: 'dapp',
			files: ['docs/vault.clauses.md', 'docs/vault.contracts.md'],
			dirs: [
				'smart-contract/',
				'smart-contract/contracts/',
				'smart-contract/contracts/vault/',
				'smart-contract/contracts/vault/src/'
			]
		},
		expected: [
			{ path: 'smart-contract/', rule: 'antelope-contract-workspace' },
			{ path: 'smart-contract/contracts/vault/', rule: 'antelope-contract-source' },
			{ path: 'smart-contract/contracts/vault/', rule: 'antelope-contract-header' },
			{ path: 'docs/vault.clauses.md', rule: 'antelope-ricardian-placement' },
			{ path: 'docs/vault.contracts.md', rule: 'antelope-ricardian-placement' }
		]
	},
	{
		name: 'accepts project CMake tooling and source, header, and Ricardian files in valid folders',
		input: {
			profile: 'dapp',
			files: [
				'contracts/CMakeLists.txt',
				'contracts/bridge/src/bridge.cpp',
				'contracts/bridge/include/bridge/bridge.hpp',
				'contracts/bridge/ricardian/bridge.clauses.md',
				'contracts/bridge/src/bridge.contracts.md'
			],
			dirs: [
				'contracts/',
				'contracts/bridge/',
				'contracts/bridge/src/',
				'contracts/bridge/include/',
				'contracts/bridge/include/bridge/',
				'contracts/bridge/ricardian/'
			]
		},
		expected: []
	},
	{
		name: 'accepts a contract-local Makefile and source and header under src',
		input: {
			profile: 'dapp',
			files: [
				'contracts/token/Makefile',
				'contracts/token/src/token.cpp',
				'contracts/token/src/token.hpp'
			],
			dirs: ['contracts/token/', 'contracts/token/src/']
		},
		expected: []
	},
	{
		name: 'accepts root CMake tooling and Ricardian documents in supported contract folders',
		input: {
			profile: 'dapp',
			files: [
				'CMakeLists.txt',
				'contracts/ballot/src/ballot.cpp',
				'contracts/ballot/src/ballot.hpp',
				'contracts/ballot/ricardian/ballot.clauses.md',
				'contracts/ballot/src/ballot.contracts.md'
			],
			dirs: [
				'contracts/',
				'contracts/ballot/',
				'contracts/ballot/src/',
				'contracts/ballot/ricardian/'
			]
		},
		expected: []
	}
];

function sourceFile(): AuditFile {
	const contents = '[[eosio::contract("bridge")]]\nstruct bridge_contract {};';
	return {
		absolutePath: '/fixture/contracts/bridge/src/bridge.cpp',
		relativePath: 'contracts/bridge/src/bridge.cpp',
		extension: '.cpp',
		contents,
		lines: contents.split('\n'),
		structuralLines: contents.split('\n'),
		limits: {
			maxFileLines: 220,
			maxFunctionLines: 55,
			maxClassLines: 120,
			maxMethodLines: 35,
			maxNestingDepth: 4,
			maxParameters: 6,
			maxComplexity: 15,
			maxClassesPerFile: 1
		},
		size: contents.length
	};
}

test('Audits contract structure from file and folder paths', () => {
	const cases = structureExamples.map(({ name, input, expected }) => {
		const output = antelopeDappAdapter.auditStructure!(input).map(({ path, rule }) => ({
			path,
			rule
		}));
		expect(output).toEqual(expected);
		return { name, input, output };
	});

	recordExampleCases(
		{
			unitId: 'audit.adapters-antelope-dapp',
			symbol: 'antelopeDappAdapter.auditStructure',
			state: 'audits-contract-structure-from-file-and-folder-paths',
			evidence: 'examples-cases',
			file: 'audits-contract-structure-from-file-and-folder-paths.json'
		},
		cases
	);
});

test('Returns no findings for source files', () => {
	const file = sourceFile();
	const metadata = {
		id: antelopeDappAdapter.id,
		label: antelopeDappAdapter.label,
		profiles: antelopeDappAdapter.profiles,
		extensions: antelopeDappAdapter.extensions,
		optionalTools: antelopeDappAdapter.optionalTools
	};
	const output = antelopeDappAdapter.audit(file);
	expect(metadata).toEqual(adapterMetadata);
	expect(output).toEqual([]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-antelope-dapp',
			symbol: 'antelopeDappAdapter.audit',
			state: 'returns-no-findings-for-source-files',
			evidence: 'examples-cases',
			file: 'returns-no-findings-for-source-files.json'
		},
		[
			{
				name: 'Antelope C++ contract source file',
				input: {
					relativePath: file.relativePath,
					extension: file.extension,
					contents: file.contents,
					lineCount: file.lines.length,
					size: file.size
				},
				output
			}
		]
	);
});
