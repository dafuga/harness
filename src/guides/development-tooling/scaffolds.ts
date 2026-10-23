import {
	scaffoldDetails,
	scaffoldKinds,
	type ScaffoldDetail
} from '../../templates/development-tooling/scaffoldTypes';
import { harnessNamingRules, harnessModuleGroupRules } from '../../rules/explorer-ui/catalog';
import type { Guide } from './guide';

export function scaffoldGuides(): Guide[] {
	return scaffoldKinds.map((kind) => scaffoldGuide(scaffoldDetails[kind]));
}

export function scaffoldsGuide(): Guide {
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
			return `${detail.kind}: ${detail.summary}${scopeLabel(detail)}`;
		}),
		antiPatterns: ['Do not guess a scaffold shape when harness info can describe it.'],
		exampleCommands: ['harness info scaffolds', 'harness info mailer --json']
	};
}

export function namingGuide(): Guide {
	return {
		topic: 'naming',
		summary:
			'Canonical source names for every module type, shared by generators, audit and code catalogs.',
		steps: [
			'Read the scaffold rule before generating code.',
			'Review the actual operation and one concrete call.',
			'Run harness audit and the project check.'
		],
		rules: [
			...Object.values(harnessNamingRules),
			...harnessModuleGroupRules,
			'Pure shared helper callables use camelCase; the helper scaffold generates a PascalNameHelper class and follows the class rule.',
			'Keep class, component, model, function and module identities identical in cards, usage links and detail headings.',
			'Preserve registered unit IDs and history when renaming source; descriptive responsibilities are separate from code names.'
		],
		antiPatterns: [
			'Do not invent a code name by recasing a descriptive title.',
			'Do not add a card-only name override.'
		],
		exampleCommands: ['harness info naming --json', 'harness info service', 'harness audit .']
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
			...(detail.kind === 'layout'
				? [
						'Layouts are reusable visual frames with a child-content slot; preview the actual frame with a labelled Child content placeholder. Routing hosts and options-only modules are not visual layouts.'
					]
				: []),
			...harnessModuleGroupRules,
			'Keep public behavior covered by focused tests.',
			eligibility(detail)
		],
		antiPatterns: ['Do not hide unrelated workflow inside the generated file.'],
		exampleCommands: [detail.exampleCommand],
		contains: detail.contains
	};
}

function eligibility(detail: ScaffoldDetail): string {
	if (detail.gameOnly) return 'This scaffold belongs in Harness game projects.';
	return detail.appOnly
		? 'This scaffold belongs in Harness app projects.'
		: 'This scaffold is package-safe.';
}

function scopeLabel(detail: ScaffoldDetail): string {
	if (detail.gameOnly) return ' Game-only.';
	return detail.appOnly ? ' App-only.' : '';
}
