import { readFileSync } from 'node:fs';
import { catalogShot } from '../../src/utils/entityScreens';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
import { scope } from '../entityPlaces';
import { withFocused } from '../entityStates';
import { unit } from '../explorerFixture';
import type { HarnessUnit, HarnessRevision } from '../../src/models/Harness.types';
import { expect, test } from 'vitest';
import ExplorerPagesScreen from '../../src/components/explorer-ui/ExplorerPagesScreen.svelte';
import { revision } from '../entityFixture';
import { content, drawn, count, screen, words } from '../entityRender';
import { commits } from '../entityUnits';

test('the pages screen lists pages as cards, each with its own screenshot and a real link', () => {
	const body = screen(ExplorerPagesScreen, 'current');
	expect(words(body)).toContain('Pages Start with the pages people use.');
	expect(count(body, /<article\b[^>]*aria-label="Orders page"/g)).toBe(1);
	expect(body).toContain('src="/harness/media/ccccccc-default-desktop.png"');
	expect(body).toContain('href="/harness/branch/feature%2Forders/pages/app.page.orders"');
	// Pages are never a table, and the screen is the one the content shows at this address.
	expect(count(body, /<table\b/g)).toBe(0);
	expect(drawn(body)).toBe(drawn(content('current')));
});

test('a revision without a registry is said to have none, and no page of another is listed', () => {
	const bare = revision(commits.middle, []);
	bare.registry = { ...bare.registry, available: false, gap: 'The registry could not be read' };
	const body = screen(ExplorerPagesScreen, 'commit', {}, { head: bare });
	expect(words(body)).toContain('No registry at this revision');
	expect(words(body)).toContain('The registry could not be read.');
	expect(count(body, /<article\b/g)).toBe(0);
});

// Exercise the real registry's preview policy through the shared capture projection.
test('every dedicated visual catalog capture can appear in its registered catalog card', () => {
	const catalog = JSON.parse(
		readFileSync('../../specification/scenarios/component-catalog-previews.json', 'utf8')
	);
	const unavailable: string[] = [];
	for (const state of catalog.states) {
		const id = state.units[0];
		const manifest = JSON.parse(readFileSync('../../specification/units/' + id + '.json', 'utf8'));
		const actual = unit(id, manifest.kind, { preview: manifest.preview }) as HarnessUnit;
		const captured = withFocused(revision(commits.tip, []), id);
		const captures = captured.regressions![0].green!.captures!;
		for (const entry of captures) entry.capture.state = state.id;
		if (id === 'reports.component.harness-harness-console') prependLoadingCaptures(captured);
		captured.registry = { ...captured.registry, units: [actual], scenarios: [catalog] };
		const evidence = explorerEvidence(scope('current'), { head: captured, parent: null }, actual);
		const rejected = {
			...evidence,
			after: {
				...evidence.after,
				captures: evidence.after.captures.map((entry) => ({ ...entry, usable: false }))
			}
		};
		expect(
			catalogShot(rejected, actual.preview, true),
			id + ' rejects unusable evidence'
		).toBeNull();
		expect(
			catalogShot(evidence, actual.preview, true)?.file,
			id + ' actual card chooses its settled default'
		).toBe('ccccccc-default-desktop.png');
		if (id === 'reports.component.harness-harness-console')
			expect(
				evidence.after.captures.filter((entry) => entry.state.startsWith('loading-'))
			).toHaveLength(6);
		const choice = actual.preview ?? { scenario: catalog.id, state: state.id, viewport: 'desktop' };
		for (const viewport of ['desktop', 'tablet', 'mobile'])
			if (!catalogShot(evidence, { ...choice, viewport })?.file)
				unavailable.push(id + ':' + viewport);
	}
	expect(unavailable, 'Captured previews visible through each registered preview choice').toEqual(
		[]
	);
});

// Historical manifests may prefer a scenario that was never captured, beside actual own-source proof.
test('default page cards show their own focused source when a historical preferred state is absent', () => {
	const captured = withFocused(revision(commits.tip, []));
	captured.registry = { ...captured.registry, units: structuredClone(captured.registry.units) };
	const page = captured.registry.units.find((unit) => unit.kind === 'page')!;
	page.preview = { scenario: 'orders-page', state: 'empty', viewport: 'desktop' };
	const shown = explorerEvidence(scope('current'), { head: captured, parent: null }, page);
	expect(catalogShot(shown, page.preview), 'Explicit unavailable state remains a gap').toBeNull();
	const body = screen(ExplorerPagesScreen, 'current', {}, { head: captured });
	expect(body).toContain('src="/harness/media/ccccccc-default-desktop.png"');
});

/** The normal Console producer records these intentional loading states before its settled state. */
function prependLoadingCaptures(detail: HarnessRevision): void {
	const captures = detail.regressions![0].green!.captures!;
	captures.unshift(
		...['loading-history', 'loading-revision'].flatMap((loading) =>
			captures.map((entry) => ({
				...entry,
				capture: {
					...entry.capture,
					state: loading,
					media: `media/${loading}-${entry.capture.viewport}.png`
				}
			}))
		)
	);
}
