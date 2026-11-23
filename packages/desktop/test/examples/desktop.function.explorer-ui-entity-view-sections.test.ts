import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entityViewSections } from '../../src/components/explorer-ui/entity-view/entityViewSections';
import type { EntitySectionsContext } from '../../src/components/explorer-ui/entity-view/entityViewSections.types';

const UNIT_ID = 'desktop.function.explorer-ui-entity-view-sections';
const PAGES: EntitySectionsContext = { entity: { category: 'pages' } };
const COMPONENT: EntitySectionsContext = { entity: { category: 'components' } };

const SELECTION_CASES = [
	{
		name: 'visual context for a pages entity',
		context: PAGES,
		headless: false,
		visual: true,
		expected: ['Overview', 'APIs', 'Designs', 'Used In', 'Uses', 'States', 'History', 'Source']
	},
	{
		name: 'headless context for a non-pages entity',
		context: {},
		headless: true,
		visual: false,
		expected: ['Overview', 'Plan', 'Used In', 'Uses', 'Examples', 'History', 'Source']
	},
	{
		name: 'headless visual context for a pages entity',
		context: PAGES,
		headless: true,
		visual: true,
		expected: [
			'Overview',
			'APIs',
			'Plan',
			'Used In',
			'Uses',
			'Examples',
			'States',
			'History',
			'Source'
		]
	}
];

test('Selects sections for each headless and visual context', () => {
	const cases = SELECTION_CASES.map(({ name, context, headless, visual, expected }) => ({
		name,
		input: { context, headless, visual },
		output: entityViewSections(context, headless, visual),
		expected
	}));

	cases.forEach((item) => {
		expect(item.output).toEqual(item.expected);
	});

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'entityViewSections',
			state: 'selects-sections-for-each-headless-and-visual-context',
			evidence: 'examples-cases',
			file: 'selects-sections-for-each-headless-and-visual-context.json'
		},
		cases.map(({ name, input, output }) => ({ name, input, output }))
	);
});

test('Keeps APIs only when the entity category is pages', () => {
	const contexts: Array<{ name: string; context: EntitySectionsContext }> = [
		{ name: 'pages category keeps APIs', context: PAGES },
		{ name: 'components category drops APIs', context: COMPONENT },
		{ name: 'null entity drops APIs', context: { entity: null } },
		{ name: 'missing entity drops APIs', context: {} }
	];
	const cases = contexts.map(({ name, context }) => ({
		name,
		input: { context, headless: false, visual: false },
		output: entityViewSections(context, false, false)
	}));

	expect(cases[0].output).toContain('APIs');
	expect(cases[1].output).not.toContain('APIs');
	expect(cases[2].output).not.toContain('APIs');
	expect(cases[3].output).not.toContain('APIs');

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'entityViewSections',
			state: 'keeps-apis-only-when-the-entity-category-is-pages',
			evidence: 'examples-cases',
			file: 'keeps-apis-only-when-the-entity-category-is-pages.json'
		},
		cases
	);
});

test('Propagates a context access failure', () => {
	const failing: EntitySectionsContext = {
		get entity(): never {
			throw new Error('entity unavailable');
		}
	};
	let thrown: unknown;
	try {
		entityViewSections(failing, false, false);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ message: 'entity unavailable' });
	if (!(thrown instanceof Error)) throw new Error('Expected the context access error.');

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'entityViewSections',
			state: 'propagates-a-context-access-failure',
			evidence: 'examples-cases',
			file: 'propagates-a-context-access-failure.json'
		},
		[
			{
				name: 'entity getter throws while reading the APIs label',
				input: { context: 'entity getter throws', headless: false, visual: false },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
