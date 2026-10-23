import { contractFields } from '../../src/utils/contractFields';
import { unit as fixtureUnit } from '../explorerFixture';
import { typeDeclarations } from '../entityClassFixtures';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import { content, words } from '../entityRender';
import { record, revision } from '../entityFixture';
import { commits, ids } from '../entityUnits';
const route = { category: 'components' as const, entity: ids.list, tab: 'contract' as const };
test('a component contract lists prop types and examples without an output section', () => {
	for (const mode of ['current', 'commit'] as const) {
		const commit = mode === 'current' ? commits.tip : commits.middle;
		const head = revision(commit, [record(commit)]);
		head.registry.units = head.registry.units.map((unit) =>
			unit.id !== ids.list
				? unit
				: {
						...unit,
						contract: {
							inputs: [
								{
									name: 'enabled',
									type: 'boolean',
									description: 'Whether the list is active.',
									examples: [false]
								},
								{ name: 'limit', type: 'number', examples: [0] },
								{ name: 'empty', type: 'unknown', examples: [null] },
								{ name: 'settings', type: 'object', examples: [{ label: 'Safe <tag>' }] }
							],
							outputs: [{ name: 'count', type: 'number', examples: [2] }],
							errors: []
						}
					}
		);
		const body = content(mode, route, { head });
		for (const text of ['boolean', 'number', 'false', '0', 'null'])
			expect(words(body)).toContain(text);
		expect(body).toContain('aria-label="Props"');
		expect(body).not.toContain('aria-label="Inputs"');
		expect(body).not.toContain('aria-label="Outputs"');
		expect(body).not.toContain('aria-label="Errors"');
		expect(words(body)).not.toContain('No errors declared.');
		expect(body).toMatch(/<table\b/);
		expect(body).toContain('aria-haspopup="dialog"');
		expect(body).toContain('View example for Enabled');
		expect(body).toMatch(/Safe &lt;tag(?:&gt;|>)/);
		expect(body).not.toContain('Whether the list is active.');
		expect(body).not.toContain('<tag>');
		expect(body).not.toMatch(/src\/|\.svelte\b/);
	}
});
test('legacy contract tables retain types and example controls for opaque fields', async () => {
	const head = revision(commits.tip, [record(commits.tip)]);
	head.registry.units = head.registry.units.map((unit) =>
		unit.id !== ids.list
			? unit
			: {
					...unit,
					contract: {
						inputs: [
							{ name: 'label', type: 'string' },
							{ name: 'context', type: 'PrivateContext' }
						],
						outputs: [{ name: 'rows', type: 'string[]' }],
						errors: []
					}
				}
	);
	const body = content('current', route, { head });
	expect(body).toContain('View example for Label');
	expect(body).toContain('View example for Context');
	expect(body).toContain('PrivateContext');
	const source = 'src/models/OrderInput.types.ts';
	const types = fixtureUnit('app.model.order-input', 'model', {
		owns: { source: [source], symbols: ['OrderInput'] },
		modelDefinitions: typeDeclarations(source)
	});
	const groups = await measureWorkload(
		'reports.function.contract-fields',
		'shared-type-declarations',
		() => contractFields(types, 'types')
	);
	expect(groups.map((group) => group.title)).toEqual(['OrderInput', 'OrderIds']);
	expect(groups[0].fields.map((field) => [field.name, field.type])).toEqual([
		['id', 'string'],
		['note?', 'string'],
		['resolve', '(key: string): number']
	]);
	expect(groups[1].fields[0]).toMatchObject({ name: 'OrderIds', type: 'string[]' });
	expect(
		groups
			.flatMap((group) => group.fields)
			.every((field) => field.source === 'missing' && field.examples.length === 0)
	).toBe(true);
	head.registry.units.push(types);
	const typed = content(
		'current',
		{ category: 'types', entity: types.id, tab: 'contract' },
		{ head }
	);
	expect(typed).toContain('aria-label="OrderInput"');
	expect(typed).toContain('aria-label="OrderIds"');
	expect(words(typed)).not.toContain('ForeignInput');
});
test('callable contracts preserve actual parameters and associate their returns', () => {
	const head = revision(commits.tip, [record(commits.tip)]);
	head.registry.units = head.registry.units.map((unit) =>
		unit.id !== ids.filter
			? unit
			: {
					...unit,
					helpers: [
						{
							name: 'countWords',
							source: 'src/functions/text.ts',
							output: 'number',
							inputs: [{ name: 'countWords.textToConvert', type: 'string' }]
						}
					],
					contract: {
						inputs: [
							{ name: 'countWords.textToConvert', type: 'string', examples: ['hello world'] }
						],
						outputs: [{ name: 'countWords.wordCount', type: 'number', examples: [2] }],
						errors: []
					}
				}
	);
	const body = content(
		'current',
		{ category: 'functions', entity: ids.filter, tab: 'contract' },
		{ head }
	);
	expect(body).toContain('aria-label="countWords contract"');
	expect(words(body)).toContain('countWords(textToConvert: string): number');
	expect(body).toContain('aria-label="Parameters"');
	expect(body).toContain('aria-label="Returns"');
	expect(body, 'return table includes the declared value name').toContain(
		'View example for wordCount'
	);
	expect(body).not.toContain('aria-label="Throws"');
	expect(words(body)).not.toContain('No errors declared.');
	expect(words(body)).not.toMatch(/Count words · Value|Runs as|Module/);
});
test('a selected callable page excludes sibling APIs and rejects missing symbols', () => {
	const head = revision(commits.tip, []);
	const unit = head.registry.units.find((item) => item.id === ids.filter)!;
	unit.helpers = [
		{ name: 'first', source: 'helpers.ts', inputs: [], output: 'string' },
		{ name: 'second', source: 'helpers.ts', inputs: [], output: 'number' }
	];
	unit.contract = {
		inputs: [],
		outputs: [
			{ name: 'first.greeting', type: 'string', examples: ['hello'] },
			{ name: 'second.answer', type: 'number', examples: [42] }
		],
		errors: [{ name: 'second.failure', type: 'TypeError' }]
	};
	for (const mode of ['current', 'commit'] as const) {
		for (const helper of ['first', 'second']) {
			const body = content(
				mode,
				{ category: 'functions', entity: ids.filter, helper, tab: 'contract' },
				{ head }
			);
			expect(body, 'detail header identifies the selected function').toMatch(
				new RegExp(`<h1[^>]*>.*?${helper}.*?</h1>`, 's')
			);
			expect(words(body), 'Helper tabs omit module ownership commentary').not.toContain(
				'Size, complexity, history, relationships and verification describe the owning module.'
			);
			expect(body).toContain(`aria-label="${helper} contract"`);
			expect(body).not.toContain(
				`aria-label="${helper === 'first' ? 'second' : 'first'} contract"`
			);
			expect(body).toContain(`View example for ${helper === 'first' ? 'greeting' : 'answer'}`);
			expect(body.includes('aria-label="Throws"')).toBe(helper === 'second');
			expect(words(body).includes('No errors declared.')).toBe(false);
			expect(words(body).includes('TypeError')).toBe(helper === 'second');
		}
		const missing = content(
			mode,
			{ category: 'functions', entity: ids.filter, helper: 'removed', tab: 'contract' },
			{ head }
		);
		expect(words(missing)).toContain('Not at this revision');
		expect(missing).not.toContain('aria-label="first contract"');
		const legacy = content(
			mode,
			{ category: 'functions', entity: ids.filter, tab: 'contract' },
			{ head }
		);
		expect(legacy).toContain(`/helpers/first/in/${ids.filter}/contract`);
		expect(legacy).toContain(`/helpers/second/in/${ids.filter}/contract`);
		expect(legacy).not.toContain('aria-label="first contract"');
	}
});
