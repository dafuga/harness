import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { referencePrompt } from '../../src/utils/agents-providers/referencePrompt';

const unitId = 'desktop.function.reference-prompt';
const state = (title: string) =>
	title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
const lines = (prompt: string) => prompt.split('\n');
const listedOf = (prompt: string) =>
	lines(prompt)[2].replace('Units you may name: ', '').split(', ');

test('lists only accepted unique ids in order', () => {
	const input = [
		'desktop.function.reference-prompt',
		'Bad Id',
		'desktop.function.entity-references',
		'desktop.function.reference-prompt',
		'single',
		'desktop.function.run-context'
	];
	const prompt = referencePrompt(input);
	expect(lines(prompt)).toHaveLength(3);
	expect(lines(prompt)[2]).toBe(
		'Units you may name: [[unit:desktop.function.reference-prompt]], [[unit:desktop.function.entity-references]], [[unit:desktop.function.run-context]]'
	);
	recordExampleCases(
		{
			unitId,
			symbol: 'referencePrompt',
			state: state('Lists only accepted unique ids in order'),
			evidence: 'examples-cases',
			file: `${state('Lists only accepted unique ids in order')}.json`
		},
		[
			{
				name: 'invalid and duplicate ids are dropped, first occurrence kept',
				input: { ids: input },
				output: prompt
			}
		]
	);
});

test('caps the listed ids at one hundred twenty', () => {
	const ids = Array.from({ length: 125 }, (_, index) => `desktop.item-${index}`);
	const prompt = referencePrompt(ids);
	const listed = listedOf(prompt);
	expect(listed).toHaveLength(120);
	expect(listed[0]).toBe('[[unit:desktop.item-0]]');
	expect(listed.at(-1)).toBe('[[unit:desktop.item-119]]');
	recordExampleCases(
		{
			unitId,
			symbol: 'referencePrompt',
			state: state('Caps the listed ids at one hundred twenty'),
			evidence: 'examples-cases',
			file: `${state('Caps the listed ids at one hundred twenty')}.json`
		},
		[
			{
				name: 'one hundred twenty five ids list the first one hundred twenty',
				input: { count: ids.length },
				output: { listed: listed.length, last: listed.at(-1) }
			}
		]
	);
});

test('names discovery or plain-word guidance for unlisted units', () => {
	const plain = referencePrompt([], false);
	const discovered = referencePrompt([], true);
	expect(lines(plain)[1]).toBe('guessed id. Name a unit that is not listed here in plain words.');
	expect(lines(discovered)[1]).toBe(
		'guessed id. For another unit, first read its canonical manifest at the selected revision; use only its verified id.'
	);
	recordExampleCases(
		{
			unitId,
			symbol: 'referencePrompt',
			state: state('Names discovery or plain-word guidance for unlisted units'),
			evidence: 'examples-cases',
			file: `${state('Names discovery or plain-word guidance for unlisted units')}.json`
		},
		[
			{
				name: 'default discovery is off and asks for plain words',
				input: { discover: false },
				output: plain
			},
			{
				name: 'discovery on requires the canonical manifest',
				input: { discover: true },
				output: discovered
			}
		]
	);
});

test('says none when no id is accepted', () => {
	const prompt = referencePrompt(['Bad Id', 'single']);
	expect(lines(prompt)).toHaveLength(3);
	expect(lines(prompt)[2]).toBe('Units you may name: none');
	recordExampleCases(
		{
			unitId,
			symbol: 'referencePrompt',
			state: state('Says none when no id is accepted'),
			evidence: 'examples-cases',
			file: `${state('Says none when no id is accepted')}.json`
		},
		[
			{
				name: 'rejected ids leave no listed unit',
				input: { ids: ['Bad Id', 'single'] },
				output: prompt
			}
		]
	);
});
