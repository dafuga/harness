import { modulesGuide } from '../module-system/modules';
import { resourcesGuide } from '../execution-runtimes/resources';
import type { Guide } from './guide.types';
import { loopGuide } from './loop';
import { benchmarkGuide } from '../agents-providers/benchmark';
import { gameGuide } from '../game-authoring/game';
import {
	harnessNamingRules,
	harnessRuleSummaries,
	harnessModuleGroupRules
} from '../../rules/explorer-ui/catalog';
import { availableGuideTopics as uniqueGuideTopics, findGuideByTopic } from './topics';
import { activityGuide } from '../projects-sessions/activity';
import { analyticsGuide, reportGuide } from '../reports-media/analytics';
import { cleanCodeGuide } from './cleanCode';
import { responseCheckGuide } from '../verification-evidence/responseCheck';
import { namingGuide, scaffoldGuides, scaffoldsGuide } from './scaffolds';
import { consoleGuides } from './console';
import { historyGuides } from '../git-source-history/history';
import { runtimeGuides } from '../execution-runtimes/runtimes';
import { unitGuides } from './units';
import { verificationGuides } from '../verification-evidence/verification';

export const guides: Guide[] = [
	modulesGuide,
	benchmarkGuide,
	resourcesGuide,
	gameGuide,
	analyticsGuide,
	activityGuide,
	reportGuide,
	cleanCodeGuide,
	responseCheckGuide,
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
			'Model contracts document source-declared methods and fields, never exported constants as outputs. Show initialization and persistence methods only when they exist; shared interfaces do not imply database behavior.',
			'Document database structure from the selected model definition in a separate Table tab. Inspect committed syntax without importing model code or reading a live database; leave dynamic schemas explicitly unresolved.',
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
		rules: [
			'Components should be reusable and visually scoped.',
			'Use props for input.',
			'Compose atoms → molecules → organisms → layouts/templates → pages. Keep the feature category separate from the level.',
			'Install native HTML, input variant and SVG atoms with harness generate elements. Configure atomicComponents() from @dafuga01/harness/atoms before vitePreprocess().',
			'Use native atom calls such as <hx-button> with a relative @harness-atoms directory to preserve bindings, actions, events and scoped styles.',
			'Declare @harness-tier. Components default to molecule; --level organism generates a feature composition. Native markup belongs only inside atoms.',
			'Reuse existing shared controls before introducing another molecule. Keep themed behavior and validation out of generated native atoms.'
		],
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
	loopGuide,
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
	namingGuide(),
	...scaffoldGuides(),
	...unitGuides,
	...runtimeGuides,
	...verificationGuides,
	...historyGuides,
	...consoleGuides
].map((guide) => {
	const naming = harnessNamingRules[guide.topic];
	return naming ? { ...guide, rules: [naming, ...guide.rules, ...harnessModuleGroupRules] } : guide;
});

export function findGuide(topic: string): Guide | undefined {
	return findGuideByTopic(guides, topic);
}

export function availableGuideTopics(): string[] {
	return uniqueGuideTopics(guides);
}

export type { Guide } from './guide.types';
