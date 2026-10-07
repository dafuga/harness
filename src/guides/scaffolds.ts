import { scaffoldDetails, scaffoldKinds, type ScaffoldDetail } from '../templates/scaffoldTypes';
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
			return `${detail.kind}: ${detail.summary}${detail.appOnly ? ' App-only.' : ''}`;
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
