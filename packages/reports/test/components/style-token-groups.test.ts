import { expect, test } from 'vitest';
import { appStyleTokensConfig } from '../../src/configs/shared-primitives/appStyleTokensConfig';
import {
	drawings,
	groupFor,
	groupTokens,
	headingId,
	sample,
	unclassified
} from '../../src/components/explorer-ui/styleTokenGroups';

const token = (name: string, group = groupFor(name)) => ({
	name,
	value: '1',
	resolved: '1',
	group
});

test('a token belongs to the first declared group whose prefix claims it, else is unclassified', () => {
	expect(groupFor('--hx-no-such-prefix-at-all')).toBe(unclassified);
	expect(groupFor('--hx-color-primary')).not.toBe(unclassified);
});

test('unclassified tokens form a last group only when there are some', () => {
	const declared = appStyleTokensConfig.groups.length;
	expect(groupTokens([]).length).toBe(declared);
	const groups = groupTokens([token('--hx-zzz-nothing')]);
	expect(groups).toHaveLength(declared + 1);
	expect(groups.at(-1)).toMatchObject({ name: unclassified });
});

test('every token name is drawn by some rule and numerals get two sample lines', () => {
	expect(drawings.find(([prefix]) => prefix.test('--hx-anything'))).toBeTruthy();
	expect(sample('--hx-style-leading-tight')).toContain('\n');
	expect(sample('--hx-type-size-sm')).toBe('Aa Bb 0123');
	expect(headingId('Colors Base color')).toBe('styles-group-colors-base-color');
});
