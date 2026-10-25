import { scaffoldKinds } from '../development-tooling/scaffoldTypes';
import type { ModuleDefinition } from '../../services/module-system/moduleDefinition.types';
/** Standard capabilities are ordinary module definitions, included before any project installation. */
export const standardCodeModules: ModuleDefinition[] = [
	['layouts', 'Layouts', 'Layout', 'layout'],
	['components', 'Components', 'Component', 'component'],
	['models', 'Models', 'Model', 'model'],
	['services', 'Services', 'Service', 'service'],
	['functions', 'Helpers', 'Helper', 'helper'],
	['types', 'Types', 'Type', 'type'],
	['configs', 'Configs', 'Config', 'config'],
	['styles', 'Styles', 'Style', 'style'],
	['dependencies', 'Dependencies', 'Dependency', 'dependency']
].map(
	([catalog, title, singular, kind], order): ModuleDefinition => ({
		schemaVersion: 1,
		id: catalog === 'functions' ? 'helpers' : catalog,
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
	if (kind === 'dependency') return { files: [], generator: { kind: 'dependency' } };
	if (kind === 'type')
		return {
			files: [
				{
					path: 'src/types/{{PascalName}}.ts',
					contents: 'export interface {{PascalName}} {\n\tid: string;\n}\n'
				}
			]
		};
	if (kind === 'style')
		return {
			files: [
				{
					path: 'src/styles/{{kebabName}}.css',
					contents: '/* {{PascalName}} styles. Reuse application design tokens. */\n'
				}
			]
		};
	const scaffold = kind === 'model' ? 'model' : scaffoldKinds.find((value) => value === kind);
	if (!scaffold) throw new Error('Unknown standard scaffold.');
	return { files: [], generator: { kind: 'scaffold', scaffold } };
}
