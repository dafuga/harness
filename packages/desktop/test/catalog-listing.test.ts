import { measureWorkload } from '../../../test/support/measureWorkload';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import type { ComponentManifest } from '../../../src/lib/contracts';
import { explorerCategory, explorerRole } from '../../reports/src/utils/explorerCategory';
import { CatalogService } from '../src/services/catalog-service/CatalogService';
import { catalogUnit, planCatalog } from '../src/utils/catalogUnit';
import { manifest } from './catalog-listing-manifests';
import { imagelessDesign, listingProject, pagePlan, previewReads } from './catalog-listing-fixture';
import {
	analytics,
	charted,
	former,
	idsOf,
	loaders,
	ordinary,
	rendered,
	twin
} from './catalog-listing-manifests';

/**
 * What the workspace lists of a commit. A page manifest that only loads for an address there is
 * left out and is still opened by its identity. What it owns at that commit decides: never a
 * title or a sentence, and never what the same identity is at another commit.
 */
const closing: Array<() => Promise<void>> = [];
afterEach(async () => {
	await Promise.all(closing.splice(0).map((close) => close()));
});
async function project() {
	const made = await listingProject({ twin: true });
	closing.push(made.close);
	return made;
}
const ids = (entities: { id: string }[]) => entities.map((entity) => entity.id).sort();
const kept = idsOf([...ordinary, twin]);
const redirects = ['analytics', 'harness-analytics', 'harness-reports', 'harness-reports-id'];

test('implemented pages select their declared screenshot rather than an absent planning image', () =>
	measureWorkload('desktop.function.catalog-unit', 'layout-catalog-behavior', async () => {
		const preview = { scenario: 'orders', state: 'loaded', viewport: 'desktop' };
		const unit = {
			...manifest(['page.orders', 'Orders', 'Shows orders.', ['src/routes/orders/+page.svelte']]),
			preview
		} as ComponentManifest;
		expect(catalogUnit(unit, new Set())?.thumbnail).toEqual({ source: 'recorded', ...preview });
		expectVisualPreviews(unit);
		expectPreviewReads(unit, preview);
		const service = {
			...unit,
			kind: 'service',
			id: 'service.payment',
			title: 'Take payments',
			owns: {
				source: ['src/lib/checkout/PaymentService.ts'],
				symbols: ['PaymentOptions', 'PaymentService']
			}
		};
		expect(catalogUnit(service, new Set())?.title).toBe('PaymentService');
		const source = { units: async () => [unit], changed: async () => new Set<string>() };
		for (const versions of [[], [imagelessDesign]]) {
			const plan = pagePlan(unit, versions);
			const planning = { plans: async () => [plan] };
			const catalog = new CatalogService(source as never, planning as never);
			expect((await catalog.list('HEAD'))[0]).toMatchObject({
				planned: false,
				hasPlan: true,
				thumbnail: { source: 'recorded', ...preview }
			});
			// A plan with no implementation still has no screenshot to display.
			expect(planCatalog(plan, null, new Set()).thumbnail).toBeNull();
		}
		const image = {
			file: 'o1-default-desktop.png',
			state: 'default',
			viewport: 'desktop',
			sha256: 'b'.repeat(64),
			bytes: 100
		};
		const designed = pagePlan(unit, [{ ...imagelessDesign, images: [image] }]);
		expect(planCatalog(designed, catalogUnit(unit, new Set()), new Set()).thumbnail).toEqual({
			version: 'v001',
			sha256: image.sha256,
			state: image.state,
			viewport: image.viewport
		});
		// A backend cannot make a headless unit reserve room for a design or screenshot.
		for (const kind of ['function', 'service', 'config'])
			expect(catalogUnit({ ...unit, kind }, new Set())?.thumbnail).toBeNull();
	}));

function expectVisualPreviews(unit: ComponentManifest): void {
	for (const kind of ['layout', 'component']) {
		const visual = { ...unit, kind, owns: { source: ['src/Frame.svelte'], symbols: ['Frame'] } };
		expect(catalogUnit(visual, new Set())?.thumbnail).toEqual({
			source: 'recorded',
			...unit.preview
		});
		expect(catalogUnit({ ...visual, preview: undefined }, new Set())?.thumbnail).toEqual(
			kind === 'layout' ? { source: 'recorded' } : null
		);
	}
	const options = { ...unit, kind: 'layout', owns: { source: ['src/+layout.ts'], symbols: [] } };
	expect(catalogUnit(options, new Set())?.thumbnail).toBeNull();
}

function expectPreviewReads(
	unit: ComponentManifest,
	declaredPreview: NonNullable<ComponentManifest['preview']>
): void {
	const { reads, preview, observed } = previewReads(unit, declaredPreview);
	const entry = catalogUnit(observed, new Set());
	expect(reads).toEqual(['preview', 'summary']);
	expect(entry?.thumbnail).toEqual({ source: 'recorded', ...preview });
}

test('the tip lists every ordinary entity and no page manifest that only loads for an address', async () => {
	const f = await project();
	const shown = await f.session.snapshot({ branch: null, commit: null });
	expect(shown.revision.commit).toBe(f.tip);
	expect(ids(shown.entities)).toEqual(kept);
	// The twin has the title and the very sentence of the loader that is left out, and is a page.
	expect(shown.entities.find((entity) => entity.id === twin[0])).toMatchObject({
		category: 'pages',
		title: '/analytics',
		summary: former
	});
	expect(ids(await f.catalog.list(f.tip))).toEqual(kept);
}, 30_000);

test('what is left out of the list is still opened by its identity, with its sources and history', async () => {
	const f = await project();
	for (const [id, title, responsibility, source] of loaders) {
		const detail = await f.catalog.entity(id, f.tip);
		expect(detail).toMatchObject({ id, title, summary: responsibility, category: 'pages' });
		expect(detail.sources).toEqual(source);
		expect(detail.history.map((entry) => entry.commit)).toContain(f.tip);
	}
	const both = (await f.catalog.entity(analytics, f.tip)).history.map((entry) => entry.commit);
	expect(both).toEqual([f.tip, f.then]);
	await expect(f.catalog.entity('page.never-held', f.tip)).rejects.toThrow('Entity not found');
}, 30_000);

test('the same identity is listed at the earlier commit where it renders, as it was there', async () => {
	const f = await project();
	const earlier = await f.session.snapshot({ branch: 'main', commit: f.then });
	expect(ids(earlier.entities)).toEqual(idsOf([rendered, ...ordinary, twin]));
	expect(earlier.entities.find((entity) => entity.id === analytics)).toMatchObject({
		category: 'pages',
		summary: charted
	});
	const page = await f.catalog.entity(analytics, f.then);
	expect([page.summary, page.sources]).toEqual([charted, rendered[3]]);
	expect(page.history.map((entry) => entry.commit)).toEqual([f.then]);
	const now = await f.session.snapshot({ branch: null, commit: null });
	expect(ids(now.entities)).not.toContain(analytics);
	expect((await f.catalog.entity(analytics, f.tip)).summary).toBe(former);
}, 30_000);

test('of the registry of this repository, the pages the explorer lists are listed and its route loaders are not', async () => {
	const directory = new URL('../../../specification/units/', import.meta.url);
	const units = readdirSync(directory)
		.filter((name) => name.endsWith('.json'))
		.map((name) => JSON.parse(readFileSync(new URL(name, directory), 'utf8')) as ComponentManifest);
	const source = { units: async () => units, changed: async () => new Set<string>() };
	const catalog = new CatalogService(source as never, { plans: async () => [] } as never);
	const listed = new Set(ids(await catalog.list('HEAD')));
	const pages = units.filter((unit) => unit.kind === 'page' && unit.status === 'active');
	const unlisted = pages.filter((unit) => !listed.has(unit.id));
	const shownByBoth = pages.filter((unit) => explorerCategory(unit) === 'pages');
	expect(shownByBoth.length).toBeGreaterThan(20);
	expect(shownByBoth.filter((unit) => !listed.has(unit.id))).toEqual([]);
	expect(unlisted.map((unit) => explorerRole(unit))).toEqual(unlisted.map(() => 'Route loader'));
	expect(unlisted.map((unit) => unit.id)).toEqual(
		expect.arrayContaining(redirects.map((name) => `reports.page.${name}`))
	);
});

test('native and hosted catalogs list pure shared contracts, models and services separately', async () => {
	const base = manifest([
		'function.format-date',
		'Formatting',
		'Formats values.',
		['src/utils/formatDate.ts']
	]);
	const pure = {
		...base,
		kind: 'function',
		helperContracts: [
			{
				name: 'formatDate',
				source: 'src/utils/formatDate.ts',
				inputs: [{ name: 'formatDate.iso', type: 'string' }],
				output: 'string',
				pure: true,
				consumers: [{ unit: 'component.one' }, { unit: 'service.two' }]
			}
		]
	};
	const units = [
		pure,
		{ ...base, kind: 'function', id: 'function.load-data' },
		{ ...base, kind: 'model', id: 'model.record' },
		{ ...base, kind: 'service', id: 'service.storage' }
	];
	const source = { units: async () => units, changed: async () => new Set<string>() };
	const catalog = new CatalogService(source as never, { plans: async () => [] } as never);
	expect(ids(await catalog.list('HEAD')), 'pure helper catalog parity').toEqual([
		'function.format-date',
		'model.record',
		'service.storage'
	]);
	expect((await catalog.list('HEAD')).find((item) => item.category === 'functions')?.title).toBe(
		'formatDate(iso)'
	);
});
