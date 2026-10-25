import {
	scaffoldDetails,
	scaffoldKinds,
	type PieceKind,
	type ScaffoldDetail
} from '../../templates/development-tooling/scaffoldTypes';
import { harnessNamingRules, harnessModuleGroupRules } from '../../rules/explorer-ui/catalog';
import type { Guide } from './guide';

/** The five standard test shapes, plus the composite, behavior-mapped and non-test cases. */
const testShapes = {
	page: {
		label: 'page screenshot match',
		rule: 'Test shape: page screenshot match. Capture each declared route state and viewport and match its committed baseline. Keep interaction, accessibility and console assertions inside those states; never auto-accept a baseline.'
	},
	component: {
		label: 'component screenshot match',
		rule: 'Test shape: component screenshot match. Capture the component at rest and at each declared interaction or error prop state, matching each committed baseline. Keep interaction, accessibility and console assertions inside those states; never auto-accept a baseline.'
	},
	helper: {
		label: 'helper examples',
		rule: 'Test shape: helper examples. Write one unit case per authored example. Its expected output or error must match the comment beside the example, such as // => "1:30", and the test asserts that exact value.'
	},
	class: {
		label: 'class method-state cases',
		rule: 'Test shape: class method-state cases. Run each public method against each declared initialization or lifecycle state, including every error case.'
	},
	api: {
		label: 'API JSON match',
		rule: 'Test shape: API JSON match. For each supported prop or error matrix row, structurally match the complete JSON response, comparing every field and every error body.'
	},
	composite: {
		label: 'per generated piece',
		rule: 'Test shape: per generated piece. The model, controller, policy and serializer take class method-state cases; the API route takes an API JSON match; the view and e2e spec take page screenshot matches; the migration maps by behavior.'
	},
	behavior: {
		label: 'map by behavior',
		rule: 'Test shape: map by behavior. Choose the one standard shape that matches its observable output: a screen or component capture, helper examples, class method-state cases or an API JSON match.'
	},
	none: {
		label: 'none',
		rule: 'Test shape: none. Static declarations and feature specifications use compiler, build, lint and audit checks; executable owners carry the matching standard cases.'
	}
} as const;

const matrixRule =
	'Keep each matrix finite and documented. For a bug, strengthen the existing case and keep the case count; add no standalone regression test.';

/** Classes take method-state cases, pure functions take helper examples, and other kinds map by behavior. */
const testShapeByKind: Record<PieceKind, keyof typeof testShapes> = {
	'game-view': 'page',
	mechanic: 'behavior',
	checkpoint: 'behavior',
	controller: 'class',
	service: 'class',
	decorator: 'class',
	component: 'component',
	feature: 'none',
	migration: 'behavior',
	view: 'page',
	layout: 'component',
	api: 'api',
	store: 'behavior',
	hook: 'behavior',
	e2e: 'page',
	adapter: 'class',
	repository: 'class',
	validator: 'class',
	serializer: 'class',
	policy: 'class',
	job: 'class',
	notification: 'class',
	seeder: 'behavior',
	command: 'class',
	util: 'behavior',
	mailer: 'class',
	helper: 'helper',
	concern: 'behavior',
	channel: 'class',
	resource: 'composite',
	form: 'class',
	partial: 'component',
	initializer: 'behavior',
	config: 'none',
	middleware: 'class'
};

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
		rules: [
			'Five standard test shapes: page and component screenshot matches, helper examples, class method-state cases and API JSON matches.',
			'Generate the owning entity to obtain its standard cases. There is no standalone test scaffold.',
			'Classes take class method-state cases; a pure function takes helper examples; any other function or kind maps by behavior.',
			'Screenshot baselines are never auto-accepted. Matrices are finite and documented; a bug fix keeps the case count and adds no standalone regression test.',
			...scaffoldKinds.map((kind) => {
				const detail = scaffoldDetails[kind];
				const shape = testShapes[testShapeByKind[kind]];
				return `${detail.kind}: ${detail.summary}${scopeLabel(detail)} Test shape: ${shape.label}.`;
			})
		],
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
			'Pure shared helper functions use camelCase. Actual classes follow the class naming and method/state testing rules.',
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
			...testShapeRules(detail.kind),
			eligibility(detail)
		],
		antiPatterns: ['Do not hide unrelated workflow inside the generated file.'],
		exampleCommands: [detail.exampleCommand],
		contains: detail.contains
	};
}

function testShapeRules(kind: PieceKind): string[] {
	const shape = testShapeByKind[kind];
	return shape === 'none' ? [testShapes.none.rule] : [testShapes[shape].rule, matrixRule];
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
