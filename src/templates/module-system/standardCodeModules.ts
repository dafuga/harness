import { scaffoldKinds } from '../development-tooling/scaffoldTypes';
import type { ModuleDefinition } from '../../services/module-system/moduleDefinition.types';
const moduleIds: Record<string, string> = { functions: 'helpers', 'module-library': 'modules' };
/** Standard capabilities are ordinary module definitions, included before any project installation. */
export const standardCodeModules: ModuleDefinition[] = [
	['apis', 'APIs', 'API endpoint', 'api'],
	['layouts', 'Layouts', 'Layout', 'layout'],
	['components', 'Components', 'Component', 'component'],
	['models', 'Models', 'Model', 'model'],
	['services', 'Services', 'Service', 'service'],
	['functions', 'Helpers', 'Helper', 'helper'],
	['types', 'Types', 'Type', 'type'],
	['configs', 'Configs', 'Config', 'config'],
	['styles', 'Styles', 'Style', 'style'],
	['dependencies', 'Dependencies', 'Dependency', 'dependency'],
	['permissions', 'Users & Permissions', 'User profile', 'profile'],
	['module-library', 'Modules', 'Module', 'module']
].map(
	([catalog, title, singular, kind], order): ModuleDefinition => ({
		schemaVersion: 1,
		id: moduleIds[catalog] ?? catalog,
		version: '1.0.0',
		title,
		includedByDefault: true,
		order,
		description: `${title} used by this project's code.`,
		instructions: [
			`Included from the start. Browse ${title} through Code; existing addresses and source identities are preserved.`,
			kind === 'dependency'
				? 'Declare an exact package@version, review it, then run bun install.'
				: `Generate a ${singular.toLowerCase()} through this module and use --group for its responsibility category.`
		],
		setup: [],
		dependencies: {},
		resources: [
			{
				id: kind,
				title,
				singular,
				kind,
				catalog: catalog as ModuleDefinition['resources'][number]['catalog'],
				primary: catalog === 'components',
				instructions: resourceInstructions(kind),
				...resourceGeneration(kind)
			}
		]
	})
);
function resourceInstructions(kind: string): string[] {
	if (kind === 'dependency')
		return [
			'Use a registry package name and exact version, such as lit@3.3.1; generation edits package.json without installing or running scripts.'
		];
	if (kind === 'api')
		return [
			'Define endpoint grants in specification/permissions/<profile>.json, then inspect them with harness api permissions <endpoint-id>. Application handlers own runtime authorization.'
		];
	if (kind === 'profile')
		return [
			'Declare each API method, page grant and data action, field and row scope explicitly. Empty grants never establish public access. Query with harness permissions list or harness permissions show <profile>.'
		];
	if (kind === 'module')
		return [
			'Edit the generated module definition, then install it with harness module add <id>. Its declared resources use the same generation and instructions contract.'
		];
	if (kind === 'helper')
		return [
			'Keep helpers pure and synchronous. The public Helpers catalog requires reviewed contracts and two distinct runtime consumers.'
		];
	if (kind === 'service')
		return [
			'Keep one responsibility per service. Shared Services requires multiple public instance methods and two distinct runtime owners.'
		];
	if (kind === 'config')
		return [
			'Declare only meaningful controls, their audience and purpose; generated configs start internal.'
		];
	return [
		'Use the existing Harness scaffold rules, implement the declared responsibility and run the generated tests.'
	];
}
function resourceGeneration(
	kind: string
): Pick<ModuleDefinition['resources'][number], 'files' | 'generator'> {
	if (kind === 'profile') return profileGeneration();
	if (kind === 'module') return moduleGeneration();
	if (kind === 'dependency') return { files: [], generator: { kind: 'dependency' } };
	if (kind === 'type')
		return {
			files: [
				{
					path: 'src/types/{{group}}/{{PascalName}}.types.ts',
					contents: 'export interface {{PascalName}} {\n\tid: string;\n}\n'
				}
			]
		};
	if (kind === 'style')
		return {
			files: [
				{
					path: 'src/styles/{{group}}/{{kebabName}}.css',
					contents: '/* {{PascalName}} styles. Reuse application design tokens. */\n'
				}
			]
		};
	const scaffold = kind === 'model' ? 'model' : scaffoldKinds.find((value) => value === kind);
	if (!scaffold) throw new Error('Unknown standard scaffold.');
	return { files: [], generator: { kind: 'scaffold', scaffold } };
}

function profileGeneration() {
	return {
		files: [
			{
				path: 'specification/permissions/{{kebabName}}.json',
				contents:
					JSON.stringify(
						{
							schemaVersion: 1,
							id: '{{kebabName}}',
							title: '{{PascalName}}',
							description: 'Describe this user profile.',
							grants: []
						},
						null,
						'\t'
					) + '\n'
			}
		]
	};
}
function moduleGeneration() {
	const file = JSON.stringify({
		path: 'src/services/{{group}}/{{PascalName}}Service.ts',
		contents: 'export class {{PascalName}}Service {}\n'
	})
		.replaceAll('{{', '\\u007b\\u007b')
		.replaceAll('}}', '\\u007d\\u007d');
	return {
		files: [
			{
				path: 'specification/modules/{{kebabName}}/module.json',
				contents: `{
 "schemaVersion":1,"id":"{{kebabName}}","version":"1.0.0","title":"{{PascalName}}",
 "description":"Describe this capability.","instructions":["Review generated code and define its contract."],"setup":[],"dependencies":{},
 "resources":[{"id":"service","title":"{{PascalName}} services","singular":"{{PascalName}} service","kind":"service","instructions":["Implement this resource."],"files":[${file}]}]
}\n`
			}
		]
	};
}
