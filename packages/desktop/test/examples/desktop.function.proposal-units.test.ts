import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { proposalUnits } from '../../src/utils/proposalUnits';
import type { Category, CatalogEntity } from '../../src/models/development-tooling/Desktop.types';

const UNIT_ID = 'desktop.function.proposal-units';

type Cases = Parameters<typeof recordExampleCases>[1];

function entity(id: string, category: Category, planned = false): CatalogEntity {
	return {
		id,
		category,
		kind: category.slice(0, -1),
		title: id,
		summary: '',
		changed: false,
		planned,
		hasPlan: false,
		lifecycle: null,
		verification: 'unknown',
		verificationNote: '',
		latestVersion: null,
		approvedVersion: null,
		threadCount: 0,
		thumbnail: null
	};
}

function recordCases(state: string, cases: Cases) {
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'proposalUnits',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Lists the request category first and skips planned entries', () => {
	const listed = [
		entity('desktop.page.summary', 'pages'),
		entity('desktop.function.first', 'functions'),
		entity('desktop.function.second', 'functions'),
		entity('desktop.function.drafted', 'functions', true),
		entity('desktop.component.card', 'components'),
		entity('desktop.function.third', 'functions')
	];
	const functionsFirst = proposalUnits(listed, {
		category: 'functions',
		text: 'Create a proposal.'
	});
	const pagesFirst = proposalUnits(listed, { category: 'pages', text: 'Create a proposal.' });
	expect(functionsFirst).toEqual([
		'desktop.function.first',
		'desktop.function.second',
		'desktop.function.third',
		'desktop.page.summary',
		'desktop.component.card'
	]);
	expect(pagesFirst).toEqual([
		'desktop.page.summary',
		'desktop.component.card',
		'desktop.function.first',
		'desktop.function.second',
		'desktop.function.third'
	]);
	recordCases('lists-the-request-category-first-and-skips-planned-entries', [
		{
			name: 'functions request with a planned function entry',
			input: { category: 'functions', listed: listed.length },
			output: functionsFirst
		},
		{
			name: 'pages request over the same catalog',
			input: { category: 'pages', listed: listed.length },
			output: pagesFirst
		}
	]);
});

test('Puts request-named registered ids first and ignores unknown or planned names', () => {
	const listed = [
		entity('desktop.page.summary', 'pages'),
		entity('desktop.component.card', 'components'),
		entity('desktop.function.first', 'functions'),
		entity('desktop.function.second', 'functions'),
		entity('desktop.function.drafted', 'functions', true)
	];
	const text =
		'Reuse desktop.component.card then desktop.page.summary, not desktop.function.drafted or desktop.missing.entry.';
	const result = proposalUnits(listed, { category: 'functions', text });
	expect(result).toEqual([
		'desktop.component.card',
		'desktop.page.summary',
		'desktop.function.first',
		'desktop.function.second'
	]);
	recordCases('puts-request-named-registered-ids-first-and-ignores-unknown-or-planned-names', [
		{
			name: 'two registered ids named, one planned and one unknown name',
			input: { category: 'functions', text },
			output: result
		}
	]);
});

test('Keeps distinct ids in listed order without a cap', () => {
	const listed = Array.from({ length: 40 }, (_, index) =>
		entity(`desktop.function.item-${String(index).padStart(2, '0')}`, 'functions')
	);
	listed.push(entity('desktop.function.item-00', 'functions'));
	const result = proposalUnits(listed, { category: 'functions', text: 'Plain request.' });
	expect(result).toEqual(listed.slice(0, 40).map((unit) => unit.id));
	expect(result).toHaveLength(40);
	recordCases('keeps-distinct-ids-in-listed-order-without-a-cap', [
		{
			name: 'forty registered functions with one repeated id',
			input: { listed: listed.length, category: 'functions' },
			output: result
		}
	]);
});
