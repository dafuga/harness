import { expect, test } from 'vitest';
import type { ContractField } from '../../src/utils/explorer-ui/contractFields';
import {
	defaultText,
	nameWords,
	requirementLabel
} from '../../src/components/shared-primitives/contractTableCells';

const field = (extra: Record<string, unknown>) =>
	({ name: 'A.b', type: 'string', examples: [], source: 'declared', ...extra }) as ContractField;

test('requirement names required, optional and unrecorded fields', () => {
	expect(requirementLabel(field({ required: true }))).toBe('Required');
	expect(requirementLabel(field({ required: false }))).toBe('Optional');
	expect(requirementLabel(field({ required: false, defaultKind: 'omitted' }))).toBe('Optional');
	expect(requirementLabel(field({}))).toBe('Requiredness not recorded');
});

test('a default is source text, including values JSON cannot show, and absent when undeclared', () => {
	expect(defaultText(field({}))).toBeNull();
	expect(defaultText(field({ default: 'x' }))).toBe('"x"');
	expect(defaultText(field({ default: null }))).toBe('null');
	expect(defaultText(field({ defaultKind: 'undefined' }))).toBe('undefined');
	expect(defaultText(field({ default: 'undefined (omitted)' }))).toBe('"undefined (omitted)"');
	expect(defaultText(field({ default: undefined }))).toBe('undefined');
});

test('a name splits at every dot', () => {
	expect(nameWords('ContractTable.group.title')).toEqual(['ContractTable', 'group', 'title']);
	expect(nameWords('plain')).toEqual(['plain']);
});
