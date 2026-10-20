const purposes: Record<string, string> = {
	adapter: 'integration boundary',
	audit: 'audit rule',
	command: 'command registration',
	component: 'Svelte component',
	config: 'typed configuration',
	endpoint: 'HTTP endpoint',
	entry: 'entry point',
	function: 'shared function',
	guide: 'static guidance',
	kernel: 'native kernel',
	layout: 'route layout',
	model: 'data model',
	module: 'library module',
	page: 'route page',
	repository: 'persistence boundary',
	script: 'build or maintenance script',
	seeder: 'seed data',
	serializer: 'serialization boundary',
	service: 'service workflow',
	style: 'stylesheet',
	template: 'scaffold template',
	validator: 'input validation',
	workflow: 'command workflow'
};

/**
 * The placeholder responsibility of a unit nobody has described yet. It restates the kind and
 * title only, so it is always labelled as derived and never passes for a reviewed statement.
 */
export function derivedResponsibility(kind: string, title: string): string {
	return `Owns the ${title} ${purposes[kind] ?? `${kind} unit`}.`;
}
