import { harnessRuleSummaries } from '../rules/catalog';
import { scaffoldDetails, scaffoldKinds, type ScaffoldDetail } from '../templates/scaffoldTypes';
import { availableGuideTopics as uniqueGuideTopics, findGuideByTopic } from './topics';

export interface Guide {
	topic: string;
	summary: string;
	steps: string[];
	rules: string[];
	antiPatterns: string[];
	exampleCommands: string[];
	contains?: string[];
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
		exampleCommands: ['harness generate model Post title:string body:text --adapter d1']
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
		antiPatterns: [
			'Do not put SQL in controllers.',
			'Do not mix page rendering and API mutation logic.'
		],
		exampleCommands: ['harness generate controller Posts']
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
		exampleCommands: ['harness generate service PublishPost']
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
		exampleCommands: ['harness generate decorator Post']
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
		exampleCommands: ['harness generate component PostCard']
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
		exampleCommands: ['harness generate feature scheduled-posts']
	},
	{
		topic: 'refactor',
		summary: 'Shrink code by extracting named responsibilities.',
		steps: [
			'Run harness audit to find oversized files and functions.',
			'Extract one responsibility at a time.',
			'Keep public behavior unchanged.',
			'Run tests after each meaningful extraction.'
		],
		rules: ['Prefer boring names.', 'Move behavior only when the new file has a clear job.'],
		antiPatterns: ['Do not refactor and add features in the same edit.'],
		exampleCommands: ['harness audit src']
	},
	{
		topic: 'code-rules',
		summary: 'Keep Harness code small, explicit, and easy for humans and agents to change safely.',
		steps: [
			'Run lint and harness audit before handing work back.',
			'Extract a named helper or class when a rule limit is reached.',
			'Move orchestration into workflows and keep command modules thin.',
			'Keep imports flowing from commands to workflows to templates/core, not backward.'
		],
		rules: [...harnessRuleSummaries],
		antiPatterns: [
			'Do not add broad Manager classes.',
			'Do not hide multiple responsibilities in one class, function, or command file.',
			'Do not bypass generated-project lint and check scripts.'
		],
		exampleCommands: ['harness audit src', 'harness info code-rules']
	},
	scaffoldsGuide(),
	...scaffoldGuides()
];

export function findGuide(topic: string): Guide | undefined {
	return findGuideByTopic(guides, topic);
}

export function availableGuideTopics(): string[] {
	return uniqueGuideTopics(guides);
}

function scaffoldGuides(): Guide[] {
	return scaffoldKinds.map((kind) => scaffoldGuide(scaffoldDetails[kind]));
}

function scaffoldsGuide(): Guide {
	return {
		topic: 'scaffolds',
		summary: 'Catalog of Harness scaffold types and what each generated code shape should contain.',
		steps: [
			'Run harness info <scaffold> for detailed guidance.',
			'Use --json when an agent needs structured scaffold metadata.',
			'Choose app-only scaffolds only inside Harness app projects.'
		],
		rules: scaffoldKinds.map((kind) => {
			const detail = scaffoldDetails[kind];
			return `${kind}: ${detail.summary}${detail.appOnly ? ' App-only.' : ''}`;
		}),
		antiPatterns: ['Do not guess a scaffold shape when harness info can describe it.'],
		exampleCommands: ['harness info scaffolds', 'harness info mailer --json']
	};
}

function scaffoldGuide(detail: ScaffoldDetail): Guide {
	return {
		topic: detail.kind,
		summary: detail.summary,
		steps: [
			'Generate the scaffold.',
			'Keep the generated file focused on one responsibility.',
			'Replace placeholder behavior with the smallest useful implementation.',
			'Run the generated test and the project check.'
		],
		rules: [
			'Generated code is a starting shape.',
			'Keep public behavior covered by focused tests.',
			detail.appOnly
				? 'This scaffold belongs in Harness app projects.'
				: 'This scaffold is package-safe.'
		],
		antiPatterns: ['Do not hide unrelated workflow inside the generated file.'],
		exampleCommands: [detail.exampleCommand],
		contains: detail.contains
	};
}
