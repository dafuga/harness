import { entityCatalog } from '../../src/utils/entityCatalog';
import { PerformanceProfileService } from '../../../../src/services/PerformanceProfileService';
import { afterAll, expect, test } from 'vitest';
import ExplorerCatalogScreen from '../../src/components/harness/ExplorerCatalogScreen.svelte';
import { record, revision } from '../entityFixture';
import { content, drawn, count, screen, words, hostProps } from '../entityRender';
import { commits } from '../entityUnits';

const kinds = {
	configs: ['Configs', 'Order settings'],
	services: ['Services', 'Order store']
} as const;

test('nonvisual collections are tables of their own kind, never image cards', () => {
	for (const [category, [title, name]] of Object.entries(kinds)) {
		const at = { category: category as keyof typeof kinds };
		const body = screen(ExplorerCatalogScreen, 'commit', at);
		expect(body, category).toContain(`<table class="ex-table" aria-label="${title}"`);
		expect(words(body), category).toContain(name);
		expect(count(body, /<article\b/g), category).toBe(0);
		expect(drawn(body), category).toBe(drawn(content('commit', at)));
	}
});

test('visual component cards show the selected revision, never the parent or another entity', () => {
	for (const [mode, commit] of [
		['current', commits.tip],
		['commit', commits.middle]
	] as const) {
		const body = screen(ExplorerCatalogScreen, mode, { category: 'components' });
		expect(count(body, /<article\b/g)).toBe(3);
		expect(count(body, /<img\b/g)).toBe(3);
		expect(body).toContain(`src="/harness/media/${commit.slice(0, 7)}-default-desktop.png"`);
		expect(body).not.toContain('src="/harness/media/aaaaaaa-');
		expect(body).toContain('/components/app.component.order-card');
		expect(words(body)).toContain('Used In');
		expect(words(body)).not.toMatch(/Contains|Shared|In context|Shows one order/);
		expect(body).not.toMatch(/hx-verdict|ex-open-page|figcaption/);
		expect(body).toContain('/pages/app.page.orders');
	}
});

test('component previews retain the origin of validated unchanged evidence', () => {
	const taken = record(commits.tip);
	taken.scenarios[0] = {
		...record(commits.middle).scenarios[0],
		status: 'referenced',
		inherited: true,
		origin: { record: 'origin', commit: commits.middle },
		originTests: [{ id: 'orders-page:orders-browser', status: 'passed' }]
	};
	const head = revision(commits.tip, [taken]);
	const body = screen(ExplorerCatalogScreen, 'current', { category: 'components' }, { head });
	expect(count(body, /<img\b/g)).toBe(3);
	expect(body).toContain('src="/harness/media/bbbbbbb-default-desktop.png"');
	expect(body).toContain('Reused from bbbbbbb');
	expect(words(body)).not.toContain('Reused from');
	expect(body).not.toContain('src="/harness/media/ccccccc-');
});

test.each(['unvalidated', 'wrong-build', 'failed', 'missing', 'unrelated'] as const)(
	'component cards leave %s captures as explicit gaps',
	(kind) => {
		const taken = record(commits.tip);
		if (kind === 'unvalidated') taken.valid = false;
		const head = revision(commits.tip, [taken]);
		if (kind === 'unrelated') {
			head.registry = { ...head.registry, scenarios: [] };
		}
		for (const state of taken.scenarios[0].states) {
			for (const capture of state.captures) {
				if (kind === 'wrong-build') capture.server!.revision = commits.first;
				if (kind === 'failed') capture.status = 'failed';
				if (kind === 'missing') capture.media = null;
			}
		}
		const body = screen(ExplorerCatalogScreen, 'current', { category: 'components' }, { head });
		expect(count(body, /<article\b/g)).toBe(3);
		expect(count(body, /<img\b/g)).toBe(0);
		expect(words(body)).toContain('No screenshot is recorded at this revision');
	}
);

test('a collection of a revision without a registry shows its gap and no table', () => {
	const bare = revision(commits.middle, []);
	bare.registry = { ...bare.registry, available: false };
	const body = screen(ExplorerCatalogScreen, 'commit', { category: 'services' }, { head: bare });
	expect(words(body)).toContain('No registry at this revision');
	expect(count(body, /<table\b/g)).toBe(0);
});

// Profile the real SSR catalog path, including its card and index, with representative fixture input.
afterAll(async () => {
	const profiler = new PerformanceProfileService();
	const host = hostProps('commit', { category: 'components' });
	await profiler.capture(
		{
			unit: 'reports.function.entity-catalog',
			workload: 'catalog-registered-components',
			iterations: 1000
		},
		() => entityCatalog(host.entities, 'components', host.lens.relations)
	);
	for (const unit of [
		'reports.component.harness-explorer-page-card',
		'reports.component.harness-explorer-index',
		'reports.component.harness-explorer-catalog-screen'
	]) {
		await profiler.capture({ unit, workload: 'three-component-catalog-ssr', iterations: 50 }, () =>
			screen(ExplorerCatalogScreen, 'current', { category: 'components' })
		);
	}
});
