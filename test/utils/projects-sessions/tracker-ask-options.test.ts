import { expect, test } from 'vitest';
import { planTrackerItemMutation as plan } from '../../../src/utils/projects-sessions/planTrackerItemMutation';
import { context, item } from './trackerItemFixture';

const options = [
	{ label: 'Ship it', effect: 'Merge and deploy today', recommended: true },
	{ label: 'Hold', effect: 'Wait for the next release' }
];
const asked = { ...item, resolved: 0, options: JSON.stringify(options) };

test('a flag stores 2 to 4 options and a confirm kind', () => {
	const fields = plan(
		{ action: 'flag', item, body: { question: 'Deploy?', options, confirm: 'deploy' } },
		context
	).fields;
	expect(fields).toMatchObject({ question: 'Deploy?', confirm: 'deploy' });
	expect(JSON.parse(String(fields.options))).toEqual(options);
});

test('options must be 2 to 4 distinct choices with at most one recommendation', () => {
	const flag = (body: object) => () =>
		plan({ action: 'flag', item, body: { question: 'Q?', ...body } }, context);
	expect(flag({ options: [options[0]] })).toThrow('2 to 4');
	expect(flag({ options: [...options, ...options, options[0]] })).toThrow('2 to 4');
	expect(flag({ options: [options[0], { label: 'ship it' }] })).toThrow('distinct');
	expect(flag({ options: [options[0], { label: 'B', recommended: true }] })).toThrow('at most one');
	expect(flag({ options, confirm: 'launch' })).toThrow('confirm must be');
});

test('answering with an option records its label and number', () => {
	const fields = plan(
		{ action: 'answer', item: asked, body: { option: 1, by: 'Daniel' } },
		context
	).fields;
	expect(fields).toMatchObject({ answer: 'Ship it', answer_option: '1', answered_by: 'Daniel' });
	expect(fields['note+']).toContain('option 1');
	expect(() => plan({ action: 'answer', item: asked, body: { option: 3 } }, context)).toThrow(
		'1 to 2'
	);
	expect(() => plan({ action: 'answer', item, body: { option: 1 } }, context)).toThrow(
		'no options'
	);
});

test('a deploy, money or secret ask refuses an option answer until it is confirmed', () => {
	const risky = { ...asked, confirm: 'secret' };
	expect(() => plan({ action: 'answer', item: risky, body: { option: 1 } }, context)).toThrow(
		'confirm step'
	);
	const fields = plan(
		{ action: 'answer', item: risky, body: { option: 2, confirmed: true } },
		context
	).fields;
	expect(fields).toMatchObject({ answer: 'Hold', answer_option: '2' });
});

test('a replacement question drops the old choices; free-text answers need text', () => {
	const fields = plan({ action: 'flag', item: asked, body: { question: 'New?' } }, context).fields;
	expect(fields).toMatchObject({ question: 'New?', options: null, confirm: null });
	expect(
		plan({ action: 'answer', item: asked, body: { answer: 'Other thing' } }, context).fields
	).toMatchObject({ answer: 'Other thing' });
	expect(() => plan({ action: 'answer', item: asked, body: {} }, context)).toThrow('answer text');
});
