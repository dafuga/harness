import type { Guide } from '../development-tooling/guide';

export const modulesGuide: Guide = {
	topic: 'modules',
	summary:
		'Install capability modules that contribute code resources, generators and instructions.',
	steps: [
		'Discover built-in and project-local definitions with harness module list.',
		'Read harness module info <id> before installing.',
		'Add a module, install its dependencies and follow its generated README.',
		'Generate a resource declared by the installed module, implement its application adapters and verify it.'
	],
	rules: [
		'Every Code destination is module-declared; nine standard capabilities are includedByDefault and optional modules require installation.',
		'Module definitions are declarative data; discovery never imports project code.',
		'Installed definitions and generated resource records live in harness.modules.json and are read from the selected revision.',
		'Project modules live in specification/modules/<id>/module.json and use the same schema as built-ins.',
		'Generators support {{name}}, {{PascalName}}, {{camelName}}, {{snakeName}}, {{group}} and {{kebabName}} substitutions in file paths and contents.',
		'Keep credentials server-only and project-specific. Installation never sends email or synchronizes application data.',
		'Offline application adapters own authentication, authorization, idempotency and conflict resolution; no default grants access.'
	],
	antiPatterns: [
		'Do not overwrite existing resource code to install a module.',
		'Do not acknowledge queued work before its durable write completes.',
		'Do not treat navigator.onLine as proof that the backend can be reached.'
	],
	exampleCommands: [
		'harness module list --json',
		'harness module info offline',
		'harness module add email',
		'harness module generate email email Welcome',
		'harness module add offline',
		'harness module generate offline collection Notes',
		'harness module generate services service Invoice --group billing',
		'harness module add rust-wasm',
		'harness module generate rust-wasm kernel Metrics',
		'harness module add rust-backend',
		'harness module generate rust-backend kernel Metrics'
	]
};
