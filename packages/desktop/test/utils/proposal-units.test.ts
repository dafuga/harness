import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import type { CatalogEntity } from '../../src/models/Desktop.types';
import { proposalPrompt } from '../../src/services/project-run-service/projectProposal';
import { proposalUnits } from '../../src/services/project-run-service/proposalUnits';

/**
 * The catalog a creation request was made in is a hint: the prompt lists registered units of
 * every catalog, the ones the request names first, and never a planned draft or any source.
 */
const unit = (id: string, category: CatalogEntity['category'], planned = false) =>
	({ id, category, planned, title: id }) as CatalogEntity;
const catalog = [
	unit('app.page.orders', 'pages'),
	unit('app.component.order-badge', 'components'),
	unit('app.function.format-time', 'functions'),
	unit('app.service.refunds', 'services'),
	unit('app.page.refund-draft', 'pages', true)
];
const listed = (prompt: string) =>
	[
		...(/^Units you may name: (.*)$/m.exec(prompt)?.[1] ?? '').matchAll(/\[\[unit:([^\]]+)\]\]/g)
	].map(([, id]) => id);

test('a pages request may name a component, a function and a service, its own catalog first', () => {
	const request = { category: 'pages' as const, text: 'Add a refunds page.' };
	expect(proposalUnits(catalog, request)).toEqual([
		'app.page.orders',
		'app.component.order-badge',
		'app.function.format-time',
		'app.service.refunds'
	]);
});

test('units the request names come first, as a reference or as a bare id, before the rest', () => {
	const text = 'Use [[unit:app.function.format-time]] and app.service.refunds, not app.page.gone.';
	expect(proposalUnits(catalog, { category: 'pages', text }).slice(0, 2)).toEqual([
		'app.function.format-time',
		'app.service.refunds'
	]);
});

test('a named unit beyond the bounded list is still listed in the prompt', () => {
	const pages = Array.from({ length: 150 }, (_, n) => unit(`app.page.p${n}`, 'pages'));
	const last = unit('app.function.zz-last', 'functions');
	const request = {
		category: 'pages' as const,
		text: 'Show it with [[unit:app.function.zz-last]].'
	};
	const prompt = proposalPrompt(request, proposalUnits([...pages, last], request));
	expect(listed(prompt)[0]).toBe('app.function.zz-last');
	expect(listed(prompt)).toHaveLength(120);
	expect(
		listed(proposalPrompt(request, proposalUnits([...pages, last], { ...request, text: '' })))
	).not.toContain('app.function.zz-last');
});

test('a planned draft is never listed and the prompt holds no source', () => {
	const request = { category: 'pages' as const, text: 'See app.page.refund-draft.' };
	const prompt = proposalPrompt(request, proposalUnits(catalog, request));
	expect(listed(prompt)).not.toContain('app.page.refund-draft');
	expect(prompt).not.toMatch(/ownedSource|import |export /);
	expect(prompt.endsWith('Request:\nSee app.page.refund-draft.')).toBe(true);
});
