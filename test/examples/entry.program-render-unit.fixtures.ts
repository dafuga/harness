import type { Operations, Manifest, Detail } from './entry.program-render-unit.test.types';
import type { Field } from '../../src/cli/program/renderUnit.types';

export const projectFields: Field[] = [
	{
		name: 'project.id',
		type: 'string',
		required: true,
		description: 'Project identifier.',
		examples: ['project-42']
	},
	{
		name: 'owner.id',
		type: 'string',
		required: true,
		description: 'Owner identifier.',
		examples: ['user-7']
	},
	{
		name: 'status',
		type: 'string',
		required: false,
		default: 'active',
		description: 'Current project status.',
		examples: ['active']
	}
];

export const saveOperations: Operations = [
	{
		name: 'saveProject',
		inputs: [{ name: 'id', type: 'string', required: true }],
		outputs: [{ name: 'saved', type: 'boolean' }],
		errors: [{ name: 'SaveError', type: 'thrown', description: 'The save operation failed.' }],
		errorStatus: 'found'
	}
];

export const manifest: Manifest = {
	schemaVersion: 1,
	id: 'entry.example',
	kind: 'entry',
	title: 'formatExample',
	responsibility: 'Formats an example unit summary.',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: { source: ['src/example.ts'], symbols: ['formatExample'] },
	contract: {
		origin: 'declared',
		inputs: [
			{
				name: 'id',
				type: 'string',
				required: true,
				description: 'Example identifier.',
				examples: ['example-42']
			}
		],
		outputs: [
			{
				name: 'summary',
				type: 'string',
				description: 'Rendered summary.',
				examples: ['Example summary']
			}
		],
		errors: [],
		errorStatus: 'declared'
	},
	dependencies: [],
	runtime: {
		kind: 'module',
		entry: 'src/example.ts',
		targets: [{ kind: 'module', entry: 'src/example.ts' }]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};

export const detail: Detail = {
	manifest,
	version: {
		unit: 'entry.example',
		manifest: 'manifest-hash',
		source: 'source-hash',
		contract: 'contract-hash',
		runtime: 'runtime-hash',
		files: [{ path: 'src/example.ts', hash: 'source-hash' }]
	},
	consumers: ['workflow.example-consumer'],
	tests: ['test/example.test.ts'],
	dependencies: []
};
