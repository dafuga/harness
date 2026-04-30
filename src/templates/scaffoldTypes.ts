export const scaffoldKinds = [
	'controller',
	'service',
	'decorator',
	'component',
	'test',
	'feature',
	'migration',
	'view',
	'layout',
	'api',
	'store',
	'hook',
	'e2e',
	'adapter',
	'repository',
	'validator',
	'serializer',
	'policy',
	'job',
	'notification',
	'seeder',
	'command',
	'util',
	'mailer',
	'helper',
	'concern',
	'channel',
	'resource',
	'form',
	'partial',
	'initializer',
	'config',
	'middleware'
] as const;

export type PieceKind = (typeof scaffoldKinds)[number];

export interface ScaffoldDetail {
	kind: PieceKind;
	summary: string;
	appOnly: boolean;
	contains: string[];
	exampleCommand: string;
}

export const scaffoldDetails: Record<PieceKind, ScaffoldDetail> = {
	controller: detail('controller', 'Request handling as a thin coordinator.', false, [
		'Controller class under src/controllers.',
		'Focused action method returning a response.',
		'Controller unit test.'
	]),
	service: detail('service', 'Workflow logic with one reason to change.', false, [
		'Service class under src/services.',
		'Small public run method as the workflow entry.',
		'Service unit test.'
	]),
	decorator: detail('decorator', 'Presentation shaping around a raw object.', false, [
		'Decorator class under src/decorators.',
		'Display-ready method.',
		'Decorator unit test.'
	]),
	component: detail('component', 'Reusable Svelte UI component.', true, [
		'Svelte component under src/components.',
		'Typed props using Svelte 5 runes.',
		'Component smoke test.'
	]),
	test: detail('test', 'Focused Vitest spec.', false, ['Vitest file under test.', 'Single starting assertion.']),
	feature: detail('feature', 'Feature specification before implementation.', false, [
		'Planned feature markdown under specification/features/planned.',
		'Overview, acceptance criteria, and future enhancements.'
	]),
	migration: detail('migration', 'Small reversible database migration.', false, [
		'SQL migration under db/migrations.',
		'Comment prompt for reversible scope.'
	]),
	view: detail('view', 'SvelteKit route page.', true, [
		'Route page under src/routes/<name>/+page.svelte.',
		'Page title and data-frame marker.',
		'Route smoke test.'
	]),
	layout: detail('layout', 'SvelteKit route layout.', true, [
		'Route layout under src/routes/<name>/+layout.svelte.',
		'Typed child snippet rendering.',
		'Layout smoke test.'
	]),
	api: detail('api', 'SvelteKit API endpoint.', true, [
		'Server route under src/routes/api/<name>/+server.ts.',
		'GET handler returning JSON.',
		'API unit test.'
	]),
	store: detail('store', 'Svelte rune store.', true, [
		'Store factory under src/lib/stores.',
		'State getter and setter.',
		'Store unit test.'
	]),
	hook: detail('hook', 'SvelteKit handle helper.', true, [
		'Handle function under src/hooks.',
		'Resolve passthrough starting point.',
		'Hook unit test.'
	]),
	e2e: detail('e2e', 'Playwright workflow spec.', true, [
		'Playwright spec under tests/e2e.',
		'Page navigation and visible route marker assertion.'
	]),
	adapter: detail('adapter', 'Integration adapter boundary.', false, [
		'Adapter class under src/adapters.',
		'Typed config object.',
		'Adapter unit test.'
	]),
	repository: detail('repository', 'Persistence collection boundary.', false, [
		'Repository class under src/repositories.',
		'Find and save methods.',
		'Repository unit test.'
	]),
	validator: detail('validator', 'Input validation boundary.', false, [
		'Validator class under src/validators.',
		'Structured valid/errors result.',
		'Validator unit test.'
	]),
	serializer: detail('serializer', 'API or export serialization.', false, [
		'Serializer class under src/serializers.',
		'Serialize method returning a plain object.',
		'Serializer unit test.'
	]),
	policy: detail('policy', 'Authorization policy logic.', false, [
		'Policy class under src/policies.',
		'Actor type and permission method.',
		'Policy unit test.'
	]),
	job: detail('job', 'Background-work shape.', false, [
		'Job class under src/jobs.',
		'Run method.',
		'Job unit test.'
	]),
	notification: detail('notification', 'Notification formatting.', false, [
		'Notification class under src/notifications.',
		'Run method as a delivery placeholder.',
		'Notification unit test.'
	]),
	seeder: detail('seeder', 'Seed-data setup.', false, [
		'Seed function under db/seed-data.',
		'Seed metadata return value.',
		'Seeder unit test.'
	]),
	command: detail('command', 'Command object for one operation.', false, [
		'Command class under src/commands.',
		'Run method.',
		'Command unit test.'
	]),
	util: detail('util', 'Tiny utility function.', false, [
		'Utility function under src/utils.',
		'Single-purpose input/output behavior.',
		'Utility unit test.'
	]),
	mailer: detail('mailer', 'Email rendering without delivery side effects.', false, [
		'Mailer class under src/mailers.',
		'Subject and text rendering methods.',
		'Mailer unit test.'
	]),
	helper: detail('helper', 'Small display helper for views or serializers.', false, [
		'Helper class under src/helpers.',
		'Format method.',
		'Helper unit test.'
	]),
	concern: detail('concern', 'Reusable cross-cutting behavior.', false, [
		'Concern function under src/concerns.',
		'Typed input and merged output.',
		'Concern unit test.'
	]),
	channel: detail('channel', 'ActionCable-style realtime boundary.', false, [
		'Channel class under src/channels.',
		'Subscribe and broadcast methods.',
		'Channel unit test.'
	]),
	resource: detail('resource', 'Full app-facing resource scaffold.', true, [
		'Model, controller, policy, serializer, migration, API route, view, and e2e spec.',
		'Unit tests for generated package-safe pieces.',
		'Route and API markers for browser verification.'
	]),
	form: detail('form', 'Form object for validation and payload shaping.', false, [
		'Form class under src/forms.',
		'Values, validate, and submit payload methods.',
		'Form unit test.'
	]),
	partial: detail('partial', 'Reusable route-level partial component.', true, [
		'Svelte partial under src/components/partials.',
		'Typed props and data-frame marker.',
		'Partial smoke test.'
	]),
	initializer: detail('initializer', 'Boot-time setup hook.', false, [
		'Initializer function under src/initializers.',
		'Typed config input.',
		'Initializer unit test.'
	]),
	config: detail('config', 'Typed feature configuration.', false, [
		'Config object under src/config.',
		'Name and enabled fields.',
		'Config unit test.'
	]),
	middleware: detail('middleware', 'Request middleware boundary.', false, [
		'Middleware class under src/middleware.',
		'Handle method that can pass through or respond.',
		'Middleware unit test.'
	])
};

export function isAppOnlyScaffold(kind: PieceKind): boolean {
	return scaffoldDetails[kind].appOnly;
}

function detail(
	kind: PieceKind,
	summary: string,
	appOnly: boolean,
	contains: string[]
): ScaffoldDetail {
	return { kind, summary, appOnly, contains, exampleCommand: `frame generate ${kind} example` };
}
