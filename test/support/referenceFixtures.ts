/** Shared declaration and reference forms for the normal revision metadata coverage. */
export const referenceCases: Array<{ files: Record<string, string>; count: number }> = [
	{
		files: {
			'src/templates/one.ts':
				"import { shared } from '../utils/shared'; export function firstTemplate() { return shared(); }",
			'src/workflows/other.ts':
				"import { shared } from '../utils/shared'; export function otherWorkflow() { return shared(); }"
		},
		count: 2
	},
	{
		files: {
			'src/config/options.ts':
				"import { shared } from '../utils/shared'; export function configuration() { return shared(); }",
			'src/routes/+page.server.ts':
				"import { shared } from '../utils/shared'; export function load() { return shared(); }"
		},
		count: 2
	},
	{
		files: {
			'src/services/OneService.ts':
				"import { shared } from '../utils/shared'; export class OneService { run() { shared(); shared(); } }"
		},
		count: 1
	},
	{
		files: {
			'src/utils/callers.ts':
				"import { shared as use } from './shared'; export function first() { use(); use(); } export function second() { [1].map(use); }"
		},
		count: 2
	},
	{
		files: {
			'src/components/One.svelte':
				"<script>import { shared } from '../utils/shared';</script><p>{shared()}</p>",
			'src/services/TwoService.ts':
				"import * as helpers from '../utils/shared'; export class TwoService { run() { helpers.shared(); } }"
		},
		count: 2
	},
	{
		files: {
			'src/utils/callers.ts':
				"import { shared } from './shared'; export function first(shared: Function) { shared(); }",
			'src/utils/types.ts':
				"import type { shared } from './shared'; export type Example = typeof shared;"
		},
		count: 0
	},
	{
		files: {
			'src/utils/callers.ts':
				"import { shared, other } from './shared'; export function first() { other(); }"
		},
		count: 0
	},
	{
		files: {
			'src/routes/+page.server.ts': "import { shared } from '../utils/shared'; shared();",
			'src/utils/barrel.ts': "export { shared } from './shared';",
			'src/utils/callers.ts':
				"import { shared } from './barrel'; export function first() { shared(); }"
		},
		count: 1
	}
];

export const serviceClassCases = [
	{
		label: 'concrete',
		declaration: 'export class SharedService { read() {} write() {} }',
		methods: ['read', 'write']
	},
	{ label: 'function', declaration: 'export function SharedService() {}', methods: null },
	{
		label: 'object',
		declaration: 'export const SharedService = { read() {}, write() {} };',
		methods: null
	},
	{
		label: 'static',
		declaration: 'export class SharedService { static read() {} static write() {} }',
		methods: []
	},
	{
		label: 'private',
		declaration:
			'export class SharedService { read() {} private write() {} protected save() {} #hidden() {} static create() {} get count() { return 1; } }',
		methods: ['read']
	},
	{
		label: 'abstract',
		declaration: 'export abstract class SharedService { read() {} write() {} }',
		methods: null
	},
	{
		label: 'callback',
		declaration: 'export class SharedService { read = () => 1; write = async () => 2; }',
		methods: ['read', 'write']
	},
	{
		label: 'inherited',
		declaration:
			"import { BaseService } from './BaseService';\nexport class SharedService extends BaseService {}",
		methods: ['read', 'write']
	},
	{
		label: 'default',
		declaration: 'export default class SharedService { read() {} write() {} }',
		methods: ['read', 'write']
	},
	{
		label: 'forward',
		declaration: 'export class SharedService { read() {} write() {} }',
		methods: ['read', 'write']
	},
	{
		label: 'registry',
		declaration: 'export class SharedService { read() {} write() {} }',
		methods: ['read', 'write']
	},
	{
		label: 'factory',
		declaration:
			'export class SharedService { read() {} write() {} static create() { return new SharedService(); } }',
		methods: ['read', 'write']
	},
	{
		label: 'shadow',
		declaration: 'export class SharedService { read() {} write() {} }',
		methods: ['read', 'write']
	}
];

export function serviceClassFiles(label: string, declaration: string): Record<string, string> {
	const binding = label === 'default' ? 'Shared' : '{ SharedService as Shared }';
	const module = label === 'forward' ? 'barrel' : 'SharedService';
	const expression = label === 'registry' ? 'Shared' : 'new Shared()';
	const body = label === 'factory' ? 'Shared.create()' : expression;
	const parameter = label === 'shadow' ? 'Shared: Function' : '';
	return {
		'src/services/SharedService.ts': declaration,
		'src/services/BaseService.ts': 'export abstract class BaseService { read() {} write() {} }',
		'src/services/barrel.ts': "export { SharedService } from './SharedService';",
		'src/workflows/first.ts': `import ${binding} from '../services/${module}'; export function first(${parameter}) { return ${body}; }`,
		'src/workflows/second.ts': `import ${binding} from '../services/${module}'; export function second(${parameter}) { return ${body}; }`
	};
}

export const declarationSource = [
	'export type Options = { enabled: boolean };',
	'export const schema = { parse: true };',
	'export const count = (1 + 2);',
	'export const typed: (value: string) => string = (value) => value;',
	'export const single = value => value;',
	'function privateHelper() { return 1; }',
	'export class Internals { run() { return 1; } }',
	'export function unused(value: number) { return value; }',
	'export const sharedArrow = (text: string): string => text;'
].join('\n');

export const modelDeclarationSource =
	'export class Example { static readonly definition = { table: "examples", fields: { id: { type: "string" } } }; } export interface ExampleInput { id: string; }';
export const modelDeclarations = [
	{
		name: 'Example',
		kind: 'class',
		source: 'src/models/payments/Example.ts',
		fields: [],
		methods: [],
		table: {
			name: 'examples',
			primaryKey: 'id',
			columns: [{ property: 'id', name: 'id', type: 'TEXT', nullable: false, primaryKey: true }]
		}
	},
	{
		name: 'ExampleInput',
		kind: 'interface',
		source: 'src/models/payments/Example.ts',
		fields: [{ name: 'id', type: 'string', optional: false }],
		methods: []
	}
];
