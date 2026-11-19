import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { categories } from '../../src/models/development-tooling/DesktopValues';
import { projectProposal, proposalPrompt } from '../../src/utils/agents-providers/projectProposal';

const UNIT = 'desktop.function.project-proposal';
const PREFIX = "The agent's proposal was not used: ";

const valid = {
	category: 'functions',
	title: 'Format elapsed time',
	goal: 'Format elapsed milliseconds for people.',
	proposal: 'Input 1500 returns 1.5 seconds.',
	contract: {
		inputs: [{ name: 'elapsed ms', type: 'number' }],
		outputs: [{ name: 'text', type: 'string' }],
		errors: ['Negative duration']
	}
};

const answer = (change: Record<string, unknown> = {}) => JSON.stringify({ ...valid, ...change });
const contractWith = (change: Record<string, unknown>) =>
	answer({ contract: { ...valid.contract, ...change } });

/** The refusal message of an answer; the test fails if the answer is accepted. */
function refusal(text: string): string {
	try {
		projectProposal(text);
	} catch (error) {
		return (error as Error).message;
	}
	return 'accepted';
}

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{ unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Reads one bounded proposal, plain or in one JSON fence, with its contract as written', () => {
	const plain = projectProposal(answer());
	const fenced = projectProposal('```json\n' + answer({ title: ' Order list ' }) + '\n```');
	const bare = projectProposal('```\n' + answer() + '\n```');
	const kept = projectProposal(
		contractWith({ inputs: [{ name: ' value ', type: 'number' }], outputs: [], errors: [] })
	);
	expect(plain).toEqual(valid);
	expect(fenced.title).toBe('Order list');
	expect(bare).toEqual(valid);
	expect(kept.contract.inputs).toEqual([{ name: ' value ', type: 'number' }]);
	recordCases('projectProposal', 'reads-one-bounded-proposal', [
		{ name: 'plain object', input: { answer: 'plain' }, output: plain },
		{ name: 'json fence with padded title', input: { answer: 'fenced' }, output: fenced },
		{ name: 'unlabelled fence', input: { answer: 'bare fence' }, output: bare },
		{ name: 'contract entry kept as written', input: { answer: 'padded name' }, output: kept }
	]);
});

test('Refuses answers that are too long, not one object, or hold unknown fields or categories', () => {
	const cases: Parameters<typeof recordCases>[2] = [];
	const refused: Array<[string, string, string]> = [
		['too long', answer({ goal: 'x'.repeat(20_000) }), `${PREFIX}it is too long.`],
		[
			'prose around the object',
			'Here is the plan: ' + answer(),
			`${PREFIX}it is not one JSON object.`
		],
		['a list', JSON.stringify([valid]), `${PREFIX}it is not one JSON object.`],
		['null', 'null', `${PREFIX}it is not one JSON object.`],
		[
			'an unknown field',
			answer({ path: 'src/elapsed.ts' }),
			`${PREFIX}it has the unknown field path.`
		],
		[
			'a long unknown field',
			answer({ ['x'.repeat(50)]: 1 }),
			`${PREFIX}it has the unknown field ${'x'.repeat(40)}.`
		],
		['an unknown category', answer({ category: 'scripts' }), `${PREFIX}its category is unknown.`]
	];
	for (const [name, text, message] of refused) {
		expect(refusal(text)).toBe(message);
		cases.push({ name, input: { answer: name }, error: message });
	}
	recordCases('projectProposal', 'refuses-answers-that-are-not-one-object', cases);
});

test('Refuses paths, source notes and out-of-bounds contract entries', () => {
	const cases: Parameters<typeof recordCases>[2] = [];
	const refused: Array<[string, string, string]> = [
		['a parent path', answer({ title: '../outside' }), `${PREFIX}its title reads as a path.`],
		['a hidden name', answer({ title: '.env' }), `${PREFIX}its title reads as a path.`],
		['a Windows path', answer({ title: 'src\\elapsed' }), `${PREFIX}its title reads as a path.`],
		[
			'a long title',
			answer({ title: 'x'.repeat(161) }),
			`${PREFIX}its title is empty, too long or not text.`
		],
		[
			'a long goal',
			answer({ goal: 'x'.repeat(601) }),
			`${PREFIX}its goal is empty, too long or not text.`
		],
		[
			'notes with source',
			answer({ proposal: '```ts\nexport const a = 1;\n```' }),
			`${PREFIX}its notes hold source code.`
		],
		[
			'long notes',
			answer({ proposal: 'x'.repeat(6001) }),
			`${PREFIX}its proposal is empty, too long or not text.`
		],
		[
			'a repeated error',
			contractWith({ errors: ['Failed', 'Failed'] }),
			`${PREFIX}its contract repeats an error.`
		],
		[
			'more than 24 outputs',
			contractWith({ outputs: Array.from({ length: 25 }, () => ({ name: 'a', type: 'b' })) }),
			`${PREFIX}its contract outputs are not a list of at most 24.`
		],
		[
			'a long field type',
			contractWith({ inputs: [{ name: 'a', type: 'x'.repeat(161) }] }),
			`${PREFIX}a contract type is empty, too long or not text.`
		],
		[
			'a blank error',
			contractWith({ errors: [' '] }),
			`${PREFIX}a contract error is empty, too long or not text.`
		],
		[
			'a field with a path',
			contractWith({ inputs: [{ name: 'a', type: 'b', path: 'src/a.ts' }] }),
			`${PREFIX}a contract field has the unknown field path.`
		],
		[
			'a contract with states',
			contractWith({ states: ['default'] }),
			`${PREFIX}its contract has the unknown field states.`
		],
		[
			'a contract without errors',
			answer({ contract: { inputs: [], outputs: [] } }),
			`${PREFIX}its contract errors are not a list of at most 24.`
		]
	];
	for (const [name, text, message] of refused) {
		expect(refusal(text)).toBe(message);
		cases.push({ name, input: { answer: name }, error: message });
	}
	recordCases('projectProposal', 'refuses-paths-notes-and-out-of-bounds-entries', cases);
});

test('Builds the proposal prompt with the five fields, known ids and the request text', () => {
	const request = {
		category: 'components' as const,
		text: 'Add a read-only panel that lists the units whose verification is unknown.'
	};
	const prompt = proposalPrompt(request, ['desktop.function.reference-prompt', 'not an id']);
	const lines = prompt.split('\n');
	expect(lines.at(-1)).toBe(request.text);
	expect(lines.at(-2)).toBe('Request:');
	expect(prompt).toContain('exactly these five fields');
	for (const category of categories) expect(prompt).toContain(category);
	expect(prompt).toContain('[[unit:desktop.function.reference-prompt]]');
	expect(prompt).not.toContain('not an id');
	expect(prompt).toContain('The request was made in the components catalog.');
	expect(prompt).toContain('Write nothing.');
	const none = proposalPrompt(request);
	expect(none).toContain('Units you may name: none');
	expect(proposalPrompt(request, ['desktop.function.reference-prompt', 'not an id'])).toBe(prompt);
	recordCases('proposalPrompt', 'builds-the-proposal-prompt-with-five-fields', [
		{
			name: 'components request with one known id',
			input: {
				category: request.category,
				known: ['desktop.function.reference-prompt', 'not an id']
			},
			output: {
				lines: lines.length,
				last: lines.at(-1),
				namesKnownId: prompt.includes('[[unit:desktop.function.reference-prompt]]')
			}
		},
		{
			name: 'no known ids names none',
			input: { category: request.category, known: [] },
			output: { namesNone: none.includes('Units you may name: none') }
		}
	]);
});
