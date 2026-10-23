import type { HarnessRuleLimits } from './catalog.types';
import type { PieceKind } from '../../templates/development-tooling/scaffoldTypes';

export const harnessRuleLimits: HarnessRuleLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
} as const;

/** Role suffixes shared by scaffold naming guidance and the source audit. */
export const harnessClassFileRules = [
	{ kind: 'controller', folder: 'controllers', suffix: 'Controller' },
	{ kind: 'service', folder: 'services', suffix: 'Service' },
	{ kind: 'decorator', folder: 'decorators', suffix: 'Decorator' },
	{ kind: 'adapter', folder: 'adapters', suffix: 'Adapter' },
	{ kind: 'repository', folder: 'repositories', suffix: 'Repository' },
	{ kind: 'validator', folder: 'validators', suffix: 'Validator' },
	{ kind: 'serializer', folder: 'serializers', suffix: 'Serializer' },
	{ kind: 'policy', folder: 'policies', suffix: 'Policy' },
	{ kind: 'job', folder: 'jobs', suffix: 'Job' },
	{ kind: 'notification', folder: 'notifications', suffix: 'Notification' },
	{ kind: 'command', folder: 'commands', suffix: 'Command' },
	{ kind: 'mailer', folder: 'mailers', suffix: 'Mailer' },
	{ kind: 'channel', folder: 'channels', suffix: 'Channel' },
	{ kind: 'form', folder: 'forms', suffix: 'Form' },
	{ kind: 'middleware', folder: 'middleware', suffix: 'Middleware' }
] as const;

/** Naming is about actual source declarations, never a recased descriptive label. */
export const harnessNamingRules: Record<string, string> = {
	helper:
		'Naming: Helpers are pure camelCase functions; colliding SDK exports use <camelName>Helper while retaining the existing binding. Implementations belong in src/helpers/<responsibility>/<camelName>.ts; keep single-consumer functions in their owner folder.',
	...(Object.fromEntries(
		harnessClassFileRules.map(({ kind, suffix }) => [
			kind,
			`Naming: ${suffix} classes use <PascalName>${suffix}.ts and export the matching class, including inside an owner's folder.`
		])
	) as Record<(typeof harnessClassFileRules)[number]['kind'], string>),
	'game-view':
		'Naming: Game views use <camelName>ViewConfig.ts with a matching camelCase config export.',
	mechanic:
		'Naming: Mechanic functions use <camelName>.ts and export the matching descriptive camelCase function.',
	checkpoint:
		'Naming: Checkpoints use <camelName>CheckpointConfig.ts with a matching camelCase config export.',
	service:
		'Naming: Service classes use <PascalName>Service.ts and export the matching class, including inside an owner folder. Shared service catalogs require instantiated classes with multiple public instance methods and two distinct active runtime owners; functions, objects and static namespaces are not service classes.',
	model:
		'Naming: Models use <PascalName>.ts with a matching class or type; type collections use <PascalName>.types.ts.',
	component: 'Naming: Components use <PascalName>.svelte and the same PascalCase import name.',
	partial: 'Naming: Partials use <PascalName>Partial.svelte and the same PascalCase import name.',
	shell: 'Naming: Shell components use <PascalName>.svelte and the same PascalCase import name.',
	function:
		'Naming: Functions and pure helper callables use descriptive camelCase names; utility modules use <camelName>.ts. Review the actual input-to-output operation, not only casing.',
	util: 'Naming: Utilities use <camelName>.ts with a matching camelCase export that describes its actual operation.',
	module:
		'Naming: Value modules use <camelName>.ts; class and type modules follow their own type rules. Keep framework .client, .server, .svelte and .d suffixes where required.',
	workflow:
		'Naming: Workflow modules use <camelName>.ts; exported operations use descriptive camelCase names.',
	config: 'Naming: Config objects use <camelName>Config.ts with a matching camelCase export.',
	store: 'Naming: Stores use <camelName>.svelte.ts and export create<PascalName>Store.',
	hook: 'Naming: Hooks use <camelName>Hook.server.ts and export <camelName>Hook; preserve the framework hooks.server.ts entry.',
	concern: 'Naming: Concerns use with<PascalName>.ts and export with<PascalName>.',
	initializer:
		'Naming: Initializers use initialize<PascalName>.ts and export initialize<PascalName>.',
	seeder: 'Naming: Seeders use <kebab-name>.ts and export seed<PascalName>.',
	view: 'Naming: Pages preserve src/routes/<kebab-name>/+page.svelte; their screen labels may be human readable.',
	page: 'Naming: Pages preserve framework +page.svelte and +page.server.ts filenames and their exported handlers.',
	layout:
		'Naming: Layouts preserve src/routes/<kebab-name>/+layout.svelte and framework handler names.',
	api: 'Naming: API routes preserve src/routes/api/<kebab-name>/+server.ts and HTTP method exports such as GET and POST.',
	entry:
		'Naming: Entrypoints keep framework-required filenames and exports; other operation modules use <camelName>.ts.',
	test: 'Naming: Unit tests use <kebab-name>.test.ts.',
	e2e: 'Naming: Browser tests use <kebab-name>.spec.ts.',
	feature: 'Naming: Feature specifications use <kebab-name>.md.',
	migration: 'Naming: Migrations use lowercase kebab-case or snake_case .sql filenames.',
	resource:
		'Naming: Each generated resource piece follows its own model, controller, policy, serializer, route or test naming rule.'
} satisfies Record<PieceKind, string> & Record<string, string>;

export const harnessModuleGroupRules = [
	'Config modules live in src/configs/<category>/, with one focused file per config. Update generator output and public SDK export plans together; prove every planned export targets an emitted file. Keep source-based config documentation static; do not execute configuration to discover values.',
	'General text helpers belong in Strings: casing, pluralization, identifier shortening and duration display formatting are reusable operations, not the domains of their callers. Keep domain-specific helpers in their domain and derive each helper category from its own implementation folder.',
	'Organize every module kind by responsibility: src/<kind>/<category>/<module>. Keep owner-private code inside its owner category and keep stable unit IDs.',
	'Use harness generate <kind> <name> --group <category> when adding code. Reuse a project category; an explicit new category extends harness.groups.json. Categories are not a fixed list.',
	'Categorized projects infer only an unambiguous whole-word match from the name or responsibility. Missing or ambiguous matches require --group; do not invent a misleading category.',
	'Share one project taxonomy across components, helpers, configs, models, services and all other module kinds. Folders drive revision-bound explorer headings and filters.',
	'Keep framework entry filenames and public routes stable; generated route groups organize files without changing URLs. Keep single-owner implementations with that owner.'
];

export const harnessRuleSummaries = harnessRuleSummariesFor(harnessRuleLimits);

export function harnessRuleSummariesFor(limits: HarnessRuleLimits): string[] {
	return [
		`Files stay at or below ${limits.maxFileLines} lines.`,
		`Functions stay at or below ${limits.maxFunctionLines} lines.`,
		`Classes stay at or below ${limits.maxClassLines} lines.`,
		`Methods stay at or below ${limits.maxMethodLines} lines.`,
		`Nesting stays at or below ${limits.maxNestingDepth} levels.`,
		`Functions and methods take at most ${limits.maxParameters} parameters.`,
		`Cyclomatic complexity stays at or below ${limits.maxComplexity}.`,
		`Each file defines at most ${limits.maxClassesPerFile} class.`,
		'Use harness info naming and the scaffold guide before naming a module.',
		...Object.values(harnessNamingRules),
		...harnessModuleGroupRules,
		'Code catalogs, usage links and detail headings retain the same recorded code name; stable dotted unit IDs and framework filenames do not change with a display title.',
		'Classes should not use catch-all Manager names.',
		'Keep named interfaces and type aliases in sibling .types.ts files; import them with import type and preserve public type paths with type-only re-exports. Index new companions under their implementation unit while retaining existing explicit type-module identities.',
		'Separate type declarations from runtime values in components, services, helpers, configs, tests and scripts. Keep shared type models with their established owner.',
		'Command modules delegate to workflows instead of importing templates or file-generation helpers.',
		'Core, template, workflow, and command imports move in one direction.',
		'Harness audit applies ecosystem adapters for app and library code surfaces.',
		'Unsupported file types must appear in audit coverage instead of being skipped silently.'
	];
}

export type { HarnessRuleLimits } from './catalog.types';
