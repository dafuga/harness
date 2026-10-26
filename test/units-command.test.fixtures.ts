import type { ComponentManifest } from '../src/core/development-tooling/unitTypes';

export const testing: NonNullable<ComponentManifest['testing']> = {
	version: 1,
	shape: 'api',
	cases: [
		{
			id: 'author-contract',
			state: 'default',
			test: {
				file: 'test/units-command.test.ts',
				title: 'authors the declared contract while preserving the rest of the manifest'
			},
			expected: { kind: 'void' }
		}
	]
};

export const manifest: ComponentManifest = {
	schemaVersion: 1,
	id: 'command.units',
	kind: 'command',
	title: 'UnitsCommand',
	responsibility: 'Owns the UnitsCommand command registration.',
	responsibilityOrigin: 'derived',
	status: 'active',
	owns: {
		source: ['src/cli/program/UnitsCommand.ts', 'src/cli/program/UnitsCommand.types.ts'],
		symbols: ['registerUnitsCommand', 'Flags']
	},
	contract: {
		origin: 'derived',
		inputs: [{ name: 'registerUnitsCommand.program', type: 'Command' }],
		outputs: [{ name: 'registerUnitsCommand', type: 'void' }],
		errors: [{ name: 'ExpectedCliError', type: 'thrown' }]
	},
	dependencies: [
		{ unit: 'function.errors', via: 'import', origin: 'derived' },
		{ unit: 'workflow.inspect-units', via: 'import', origin: 'derived' },
		{ unit: 'workflow.manage-units', via: 'import', origin: 'derived' }
	],
	runtime: {
		kind: 'module',
		entry: 'src/cli/program/UnitsCommand.ts',
		targets: [{ kind: 'module', entry: 'src/cli/program/UnitsCommand.ts' }]
	},
	scenarios: [],
	testing: { version: 1, shape: 'api', props: ['existing-metadata'], cases: testing.cases },
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};

export const input = {
	responsibility: 'Authors declared contracts for existing units.',
	contract: {
		inputs: [{ name: 'id', type: 'string', description: 'Stable unit identity.' }],
		outputs: [{ name: 'manifest', type: 'ComponentManifest' }],
		errors: [{ name: 'invalid', type: 'ExpectedCliError' }]
	}
};

export const invalidCases = [
	...[
		{ name: 'null testing', testing: null },
		{ name: 'unsupported testing version', testing: { ...testing, version: 2 } },
		{ name: 'unsupported testing shape', testing: { ...testing, shape: 'unknown' } },
		{ name: 'empty testing cases', testing: { ...testing, cases: [] } },
		{ name: 'unknown testing key', testing: { ...testing, unexpected: true } },
		{
			name: 'unknown testing case key',
			testing: { ...testing, cases: [{ ...testing.cases[0], unexpected: true }] }
		},
		{
			name: 'missing testing test title',
			testing: {
				...testing,
				cases: [{ ...testing.cases[0], test: { file: 'test/units-command.test.ts' } }]
			}
		},
		{
			name: 'unknown testing expected key',
			testing: {
				...testing,
				cases: [{ ...testing.cases[0], expected: { kind: 'void', unexpected: true } }]
			}
		}
	].map(({ name, testing }) => ({
		name,
		id: manifest.id,
		text: JSON.stringify({ ...input, testing }),
		manifests: [manifest]
	})),
	{ name: 'malformed JSON', id: manifest.id, text: '{', manifests: [manifest] },
	{
		name: 'unknown top-level key',
		id: manifest.id,
		text: JSON.stringify({ ...input, unexpected: true }),
		manifests: [manifest]
	},
	{
		name: 'unknown contract key',
		id: manifest.id,
		text: JSON.stringify({ ...input, contract: { ...input.contract, unexpected: true } }),
		manifests: [manifest]
	},
	{
		name: 'unknown item key',
		id: manifest.id,
		text: JSON.stringify({
			...input,
			contract: {
				...input.contract,
				outputs: [{ name: 'manifest', type: 'ComponentManifest', extra: true }]
			}
		}),
		manifests: [manifest]
	},
	{
		name: 'missing typed field',
		id: manifest.id,
		text: JSON.stringify({
			...input,
			contract: { ...input.contract, outputs: [{ name: 'manifest' }] }
		}),
		manifests: [manifest]
	},
	{
		name: 'unknown unit',
		id: 'function.missing',
		text: JSON.stringify(input),
		manifests: [manifest]
	},
	{
		name: 'retired unit',
		id: manifest.id,
		text: JSON.stringify(input),
		manifests: [{ ...manifest, status: 'retired' }]
	}
];
