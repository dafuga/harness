import { expect, test } from 'vitest';
import {
	projectProposal,
	proposalPrompt
} from '../../src/services/project-run-service/projectProposal';

const contract = {
	inputs: [{ name: 'elapsed ms', type: 'number | bigint' }],
	outputs: [{ name: 'text', type: 'string' }],
	errors: ['Negative duration']
};
const valid = {
	category: 'functions',
	title: 'Format elapsed time',
	goal: 'Format elapsed milliseconds for people.',
	proposal: 'Input 1500 returns 1.5 seconds.',
	contract
};
const answer = (change: object = {}) => JSON.stringify({ ...valid, ...change });
const agreed = (change: object) => answer({ contract: { ...contract, ...change } });
const field = { name: 'value', type: 'number' };

test('a proposal of five bounded fields is read, its contract exactly as it was authored', () => {
	expect(projectProposal(answer())).toEqual(valid);
	const fenced = '```json\n' + answer({ title: ' Order list ' }) + '\n```';
	expect(projectProposal(fenced).title).toBe('Order list');
	const none = { inputs: [], outputs: [], errors: [] };
	expect(projectProposal(answer({ contract: none })).contract).toEqual(none);
	const full = Array.from({ length: 24 }, (_item, at) => ({ name: `value ${at}`, type: 'text' }));
	expect(projectProposal(agreed({ inputs: full })).contract.inputs).toEqual(full);
});

test.each([
	['prose around the object', 'Here is the plan: ' + answer()],
	['a list', JSON.stringify([valid])],
	['an unknown field', answer({ path: 'src/elapsed.ts' })],
	['an unknown category', answer({ category: 'scripts' })],
	['an empty title', answer({ title: ' ' })],
	['a long title', answer({ title: 'x'.repeat(161) })],
	['a parent path', answer({ title: '../outside' })],
	['a file path', answer({ title: 'src/utils/elapsed' })],
	['a Windows path', answer({ title: 'src\\elapsed' })],
	['a hidden name', answer({ title: '.env' })],
	['a missing goal', JSON.stringify({ ...valid, goal: undefined })],
	['notes that are an object', answer({ proposal: { write: 'src/a.ts' } })],
	['notes that hold source', answer({ proposal: '```ts\nexport const a = 1;\n```' })],
	['notes that are too long', answer({ proposal: 'x'.repeat(6001) })],
	['an answer that is too long', answer({ goal: 'x'.repeat(20000) })],
	['no contract', JSON.stringify({ ...valid, contract: undefined })],
	['a contract that is not an object', answer({ contract: null })],
	['a contract with states of its own', agreed({ states: ['default'] })],
	['a contract without its errors', answer({ contract: { inputs: [], outputs: [] } })],
	['inputs that are not a list', agreed({ inputs: field })],
	['more than 24 outputs', agreed({ outputs: Array.from({ length: 25 }, () => field) })],
	['a field with a path', agreed({ inputs: [{ ...field, path: 'src/a.ts' }] })],
	['a field without a type', agreed({ inputs: [{ name: 'value' }] })],
	['an empty name', agreed({ outputs: [{ ...field, name: ' ' }] })],
	['a type that is too long', agreed({ inputs: [{ ...field, type: 'x'.repeat(161) }] })],
	['an error that is not text', agreed({ errors: [{ name: 'Failed' }] })],
	['an error that is said twice', agreed({ errors: ['Failed', 'Failed'] })]
])('%s is refused before anything is written', (_name, text) => {
	expect(() => projectProposal(text)).toThrow(/proposal was not used/);
});

test('the question asks for the fixed form, bounds what may be read and says to write nothing', () => {
	const prompt = proposalPrompt({ category: 'components', text: 'Add an order badge' });
	expect(prompt).toContain('Write nothing.');
	expect(prompt).toContain('exactly these five fields');
	expect(prompt).toContain('"contract": {"inputs": [{"name", "type"}]');
	expect(prompt).toContain('Do not\nread the implementation of other registered units');
	expect(prompt).toContain('pages, layouts, components, functions, configs, services, models');
	expect(prompt).toContain('made in the components catalog');
	expect(prompt.endsWith('Request:\nAdd an order badge')).toBe(true);
});
