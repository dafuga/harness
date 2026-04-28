export interface Guide {
	topic: string;
	summary: string;
	steps: string[];
	rules: string[];
	antiPatterns: string[];
	exampleCommands: string[];
}

export const guides: Guide[] = [
	{
		topic: 'model',
		summary: 'Add data behavior through a small ActiveRecord-like model and an adapter.',
		steps: [
			'Generate the model with fields and the target adapter.',
			'Keep persistence calls inside the model or adapter, not in controllers.',
			'Add validations near the model before wiring UI or API behavior.',
			'Write model tests before adding higher-level workflow tests.'
		],
		rules: [
			'One model file owns one table-shaped concept.',
			'Use adapters for D1, SQLite, and Postgres differences.',
			'Keep queries named by intent instead of scattering SQL.'
		],
		antiPatterns: [
			'Do not put controller response formatting in models.',
			'Do not create a generic database utility that knows every table.'
		],
		exampleCommands: ['frame generate model Post title:string body:text --adapter d1']
	},
	{
		topic: 'controller',
		summary: 'Add request handling as a thin coordinator.',
		steps: [
			'Generate the controller.',
			'Call models and services from small action methods.',
			'Return a consistent response shape.',
			'Cover the action with a focused test.'
		],
		rules: [
			'Controllers parse input and shape output.',
			'Business decisions belong in services or models.',
			'Each action should fit on one screen.'
		],
		antiPatterns: ['Do not put SQL in controllers.', 'Do not mix page rendering and API mutation logic.'],
		exampleCommands: ['frame generate controller Posts']
	},
	{
		topic: 'service',
		summary: 'Add workflow logic in a small class with one reason to change.',
		steps: [
			'Generate the service.',
			'Name the public method after the business action.',
			'Inject collaborators instead of importing global state.',
			'Test success and failure paths.'
		],
		rules: ['Services orchestrate work.', 'Services should not own database adapter details.'],
		antiPatterns: ['Do not make a service named Manager.', 'Do not collect unrelated helpers.'],
		exampleCommands: ['frame generate service PublishPost']
	},
	{
		topic: 'decorator',
		summary: 'Add presentation shaping without polluting models.',
		steps: [
			'Generate the decorator.',
			'Accept the raw object in the constructor or function input.',
			'Expose display-ready methods.',
			'Keep formatting rules covered by tests.'
		],
		rules: ['Decorators format and derive display values.', 'Decorators do not fetch data.'],
		antiPatterns: ['Do not hide database writes in decorators.'],
		exampleCommands: ['frame generate decorator Post']
	},
	{
		topic: 'component',
		summary: 'Add UI as a focused Svelte component.',
		steps: [
			'Generate the component.',
			'Use typed props and Svelte 5 runes.',
			'Keep data loading outside reusable components.',
			'Add a component test or page smoke test.'
		],
		rules: ['Components should be reusable and visually scoped.', 'Use props for input.'],
		antiPatterns: ['Do not embed unrelated feature workflows in one component.'],
		exampleCommands: ['frame generate component PostCard']
	},
	{
		topic: 'feature',
		summary: 'Write the spec before implementation.',
		steps: [
			'Generate a planned feature spec.',
			'List acceptance criteria as measurable gates.',
			'Implement only the scoped behavior.',
			'Move the spec to implemented when complete.'
		],
		rules: ['Specs are the source of truth.', 'Acceptance criteria define done.'],
		antiPatterns: ['Do not implement hidden scope without updating the spec.'],
		exampleCommands: ['frame generate feature scheduled-posts']
	},
	{
		topic: 'refactor',
		summary: 'Shrink code by extracting named responsibilities.',
		steps: [
			'Run frame audit to find oversized files and functions.',
			'Extract one responsibility at a time.',
			'Keep public behavior unchanged.',
			'Run tests after each meaningful extraction.'
		],
		rules: ['Prefer boring names.', 'Move behavior only when the new file has a clear job.'],
		antiPatterns: ['Do not refactor and add features in the same edit.'],
		exampleCommands: ['frame audit src']
	}
];

export function findGuide(topic: string): Guide | undefined {
	return guides.find((guide) => guide.topic === topic);
}
