import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { renderGuide } from '../../src/guides/development-tooling/render';

const localGuide = {
	topic: 'Local rendering',
	summary: 'Render the guide as Markdown.',
	steps: ['Read the guide data.', 'Call renderGuide.'],
	contains: ['A topic heading.', 'Section lists.'],
	rules: ['Keep section order.'],
	antiPatterns: ['Return HTML.'],
	exampleCommands: ['npm run dev']
};

const guideWithoutContains = {
	topic: 'Local rendering',
	summary: 'Render the guide as Markdown.',
	steps: ['Read the guide data.', 'Call renderGuide.'],
	rules: ['Keep section order.'],
	antiPatterns: ['Return HTML.'],
	exampleCommands: ['npm run dev']
};

const fullOutput =
	'# Local rendering\n\nRender the guide as Markdown.\n\n' +
	'## Steps\n- Read the guide data.\n- Call renderGuide.\n\n' +
	'## Contains\n- A topic heading.\n- Section lists.\n\n' +
	'## Rules\n- Keep section order.\n\n' +
	'## Anti-patterns\n- Return HTML.\n\n' +
	'## Example commands\n- npm run dev\n';

const outputWithoutContains =
	'# Local rendering\n\nRender the guide as Markdown.\n\n' +
	'## Steps\n- Read the guide data.\n- Call renderGuide.\n\n\n' +
	'## Rules\n- Keep section order.\n\n' +
	'## Anti-patterns\n- Return HTML.\n\n' +
	'## Example commands\n- npm run dev\n';

test('Renders the topic, summary and every section in order', () => {
	const output = renderGuide(localGuide);
	expect(output).toBe(fullOutput);
	expect(output.startsWith('# Local rendering\n\nRender the guide as Markdown.')).toBe(true);
	expect(output.endsWith('\n')).toBe(true);

	recordExampleCases(
		{
			unitId: 'guide.render',
			symbol: 'renderGuide',
			state: 'renders-the-topic-summary-and-every-section-in-order',
			evidence: 'examples-cases',
			file: 'renders-the-topic-summary-and-every-section-in-order.json'
		},
		[{ name: 'full guide with contains', input: localGuide, output }]
	);
});

test('Omits the Contains heading when contains is absent', () => {
	const output = renderGuide(guideWithoutContains);
	expect(output).toBe(outputWithoutContains);
	expect(output.includes('## Contains')).toBe(false);

	recordExampleCases(
		{
			unitId: 'guide.render',
			symbol: 'renderGuide',
			state: 'omits-the-contains-heading-when-contains-is-absent',
			evidence: 'examples-cases',
			file: 'omits-the-contains-heading-when-contains-is-absent.json'
		},
		[{ name: 'guide without contains', input: guideWithoutContains, output }]
	);
});
