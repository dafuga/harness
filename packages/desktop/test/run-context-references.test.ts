import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { RunContext } from '../src/models/RunContext.types';
import { proposalPrompt } from '../src/utils/projectProposal';
import { runContext } from '../src/utils/runContext';

/**
 * The prompts an agent is actually given ask it to name units by their registered ids as
 * [[unit:<id>]], and say which ids a plan or change of one entity may name.
 */
const context = {
	entity: {
		id: 'app.page.orders',
		title: 'Orders',
		summary: 'Lists the orders.',
		contract: { inputs: [], outputs: [], errors: [] },
		sources: [],
		relationships: [
			{ id: 'app.shell.order-frame', title: 'Order frame', category: 'shells', direction: 'uses' },
			{
				id: 'app.function.format-time',
				title: 'Format time',
				category: 'functions',
				direction: 'uses'
			},
			{
				id: 'app.shell.order-frame',
				title: 'Order frame',
				category: 'shells',
				direction: 'used-by'
			}
		]
	},
	request: { threadId: 'thread-1', text: 'Show the newest order first.' },
	planning: { messages: async () => [] },
	revision: { branch: 'main', commit: 'a'.repeat(40), tip: 'a'.repeat(40), atTip: true }
} as unknown as RunContext;
const named = (prompt: string) =>
	[
		...(/^Units you may name: (.*)$/m.exec(prompt)?.[1] ?? '').matchAll(/\[\[unit:([^\]]+)\]\]/g)
	].map(([, id]) => id);

test.each([undefined, 'dev', 'stage', 'preprod', 'prod'] as const)(
	'a %s plan or change prompt names references and its exact promotion boundary',
	async (environment) => {
		const prompt = await runContext({
			...context,
			request: { ...context.request, environment }
		} as RunContext);
		const boundary = environment === 'prod' ? 'preprod' : (environment ?? 'local only');
		expect(prompt).toContain(
			`Automatic promotion stops at ${boundary}; production requires the Deploy UI.`
		);
		expect(prompt).toContain('Name a unit as [[unit:<id>]] with its registered id');
		expect(named(prompt)).toEqual([
			'app.page.orders',
			'app.shell.order-frame',
			'app.function.format-time'
		]);
		expect(prompt).toContain('Request:\nShow the newest order first.');
	}
);

test('the creation prompt asks the notes to name existing units by registered id', () => {
	const prompt = proposalPrompt({ category: 'pages', text: 'Add a page for refunds.' });
	expect(prompt).toContain('Name a unit as [[unit:<id>]] with its registered id');
	expect(prompt.endsWith('Request:\nAdd a page for refunds.')).toBe(true);
});
