import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import ExplorerCatalogScreen from '../../src/components/explorer-ui/ExplorerCatalogScreen.svelte';
import { record, revision } from '../entityFixture';
import { content, drawn, count, screen, words } from '../entityRender';
import { commits, ids } from '../entityUnits';
import { configStrings } from '../entityConfigFixtures';

const kinds = { configs: ['Configs', 'orderSettings'] } as const;

test.each(['initializer', 'entry'])('Configs exclude non-config %s modules', (kind) => {
	const head = revision(commits.middle, [record(commits.middle)]);
	head.registry.units.find((unit) => unit.id === ids.settings)!.kind = kind;
	const body = screen(ExplorerCatalogScreen, 'commit', { category: 'configs' }, { head });
	expect(count(body, /<table\b/g)).toBe(0);
	expect(words(body)).toContain('No configs are in the registry of this revision.');
});

test('nonvisual collections are tables of their own kind, never image cards', () =>
	measureWorkload(
		'reports.component.harness-explorer-table',
		'render-nonvisual-catalog-table',
		() =>
			measureWorkload('reports.function.entity-catalog', 'config-catalog-render', () => {
				for (const [category, [, name]] of Object.entries(kinds)) {
					const at = { category: category as keyof typeof kinds };
					const body = screen(ExplorerCatalogScreen, 'commit', at);
					expect(body, category).toMatch(
						new RegExp(`<table class="ex-table(?: [^"]*)?" aria-label="${name}"`)
					);
					expect(words(body), category).toContain(name);
					expect(words(body), 'configs list variable names and source values').toContain(
						'pageSize 25'
					);
					expect(words(body)).toContain('build.cssCodeSplit true');
					expect(count(body, /scope="col"/g), 'only variable and value columns').toBe(2);
					expect(words(body)).not.toMatch(/Purpose|Used by|Changed|Verification/);
					for (const value of ['false', '0', 'null', 'Empty string'])
						expect(words(body)).toContain(value);
					for (const [key, literal] of Object.entries(configStrings)) {
						expect(words(body), 'decoded strings are initially readable').toContain(
							literal.split('\n')[0]
						);
						expect(body).not.toContain(`aria-label="View value for orderSettings.${key}"`);
					}
					expect(body).toContain('&lt;orders> &amp; details');
					expect(body).not.toContain('<orders>');
					expect(count(body, /<article\b/g), category).toBe(0);
					expect(drawn(body), category).toBe(drawn(content('commit', at)));
				}
			})
	));

test.each([
	['orderSettings.build.cssCodeSplit', 'build.cssCodeSplit'],
	['orderSettingsExtra.enabled', 'orderSettingsExtra.enabled'],
	['otherSettings.enabled', 'otherSettings.enabled'],
	['orderSettings', 'orderSettings']
])('config variable %s has an unambiguous label', (name, label) => {
	for (const mode of ['current', 'commit'] as const) {
		const commit = mode === 'current' ? commits.tip : commits.middle;
		const head = revision(commit, [record(commit)]);
		const unit = head.registry.units.find((unit) => unit.id === ids.settings)!;
		unit.configValues = [{ name, value: 'false', literal: false, source: unit.owns.source[0] }];
		const body = screen(ExplorerCatalogScreen, mode, { category: 'configs' }, { head });
		const names = [...body.matchAll(/<code class="ex-config-name[^"]*">(.*?)<\/code>/gs)];
		expect(names.map((match) => words(match[0]).trim())).toEqual([label]);
		const scope = `/branch/feature%2Forders${mode === 'current' ? '' : `/commit/${commit}`}`;
		expect(body).toContain(`${scope}/configs/${ids.settings}`);
	}
});

test('service cards show only the class name and revision-scoped consumer links', () => {
	for (const mode of ['current', 'commit'] as const) {
		const body = screen(ExplorerCatalogScreen, mode, { category: 'services' });
		expect(count(body, /<article\b/g), 'services use the helper card grid').toBe(1);
		const card = /<article\b.*?<\/article>/s.exec(body)![0];
		expect(words(card).trim()).toBe('OrderStore Used In OrderList SearchBox');
		expect(card).not.toMatch(/<h2|<p\b|<img|<button|<svg|hx-verdict/);
		expect(count(card, /<a\b/g)).toBe(3);
		const scope = `/branch/feature%2Forders${mode === 'current' ? '' : `/commit/${commits.middle}`}`;
		expect(card).toContain(`${scope}/services/${ids.store}`);
		expect(card).toContain(`${scope}/components/${ids.list}`);
		expect(card).not.toContain('helper=');
		expect(count(body, /<table\b/g)).toBe(0);
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
	}
});

test('component cards keep reused screenshots revision-bound without extra source text', () => {
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
	expect(words(body)).not.toContain('Reused from bbbbbbb');
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
