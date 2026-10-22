import { expect, test } from '../../../../test/support/browserTest';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { scenarioManifestSchema } from '../../../../src/core/unitTypes';
import { gatherCaptures } from '../../../../src/services/check-run-service/gatherCaptures';
import { focusedScreens } from '../../../../src/services/regression-proof-service/focusedScreens';
import { scenarioCoverage } from '../../../../src/services/verification-service/scenarioCoverage';
import type { Gathered } from '../../../../src/utils/verification-evidence/gatherCaptures';
import type { HarnessScenario, HarnessUnit } from '../../src/models/Harness.types';
import { scenarioFor } from '../../src/utils/explorerState';
import { reportBuildIdentity } from '../../src/utils/reportBuildIdentity';
import { captureFlow } from './support/explorerFlow';
import { askedFor, explorerFlows, explorerStates as states } from './support/explorerStates';
import {
	captureAudio,
	captureScreen,
	evidenceDirectory,
	revision,
	servedBuild,
	viewports,
	type Viewport
} from './support/harnessCapture';
import { fixtures } from './support/fixtures';
import { expectPageMeasurements, pageUnit, shownUnits } from './support/pageBenchmark';

const manifest = JSON.parse(
	readFileSync('../../specification/scenarios/harness-console.json', 'utf8')
) as unknown;
const scenario = scenarioManifestSchema.parse(manifest);
// The same declaration and registry as the explorer reads them when it shows a unit's captures.
const declared = manifest as HarnessScenario;
const registry = readdirSync('../../specification/units').map(
	(file) => JSON.parse(readFileSync(`../../specification/units/${file}`, 'utf8')) as HarnessUnit
);
const visual = new Set(
	registry.filter(({ kind }) => ['page', 'shell', 'component'].includes(kind)).map(({ id }) => id)
);
/** What each state showed: the units drawn in its window, one list per viewport. */
const shown = new Map<string, string[][]>();

const built = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_EXPOSED_PORT || 5592)}`;
test.use({ baseURL: built });
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => rmSync(evidenceDirectory, { recursive: true, force: true }));

for (const viewport of viewports) {
	test(`every explorer state is captured at the ${viewport.id} viewport`, async ({ page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		for (const [state, reach] of Object.entries(states)) {
			await reach(page);
			const actualPage = pageUnit(page.url());
			expect(actualPage, state).toBeDefined();
			expect(scenario.states.find((entry) => entry.id === state)?.units, state).toContain(
				actualPage
			);
			await captureScreen(page, state, viewport as Viewport);
			shown.set(state, [...(shown.get(state) ?? []), await shownUnits(page)]);
			// What a flow asked for and what the application then showed is recorded once.
			const flow = viewport.id === 'desktop' ? explorerFlows[state] : undefined;
			if (flow) await captureFlow(page, { state, asked: askedFor(state), ...flow });
		}
	});
}

test('the recorded tone plays through the explorer player and is captured as it was served', async ({
	page
}) => {
	await states.media(page);
	const seconds = await captureAudio(page, 'media', page.locator('.ex-content audio').first());
	expect(seconds).toBeCloseTo(0.25, 1);
});

test('what was captured satisfies the scenario contract, and another build would not', async ({
	page
}) => {
	const { gathered, failures } = gatherCaptures(evidenceDirectory, 'evidence');
	expect(failures).toEqual([]);
	const flows = Object.keys(explorerFlows).length * 2;
	const captures = gathered.filter((item) => item.line.kind !== 'benchmark');
	expect(captures).toHaveLength(Object.keys(states).length * viewports.length + flows + 1);
	// The server reports the digest of the very files it was started from.
	const served = await servedBuild(page);
	// The server reports the digest of the very files it was started from: this run's own copy.
	expect(served).toEqual({ buildId: reportBuildIdentity(fixtures.build), revision });
	const judge = (compiled: string) =>
		scenarioCoverage({
			scenario,
			commit: revision,
			gathered,
			checkFailed: false,
			builds: { declared: ['reports'], compiled: new Map([['reports', compiled]]) }
		});
	const judged = judge(served?.buildId ?? '');
	expect(judged.failures).toEqual([]);
	const tone = judged.states
		.flatMap((state) => state.captures)
		.find((item) => item.kind === 'audio');
	expect(tone).toMatchObject({
		status: 'passed',
		provenance: 'actual-capture',
		mediaType: 'audio/wav',
		transcript: 'Synthetic test tone. No speech.',
		durationSeconds: 0.25
	});
	// The same captures judged against the files of any other build are all rejected.
	const other = judge('f'.repeat(64));
	expect(other.failures).toHaveLength(captures.length);
	expect(other.failures[0]).toMatch(
		/was served by build [0-9a-f]{12}, not the reports build f{12}/
	);
	// Each visual unit keeps its own screenshots. Navigation measures belong to hard-loaded pages;
	// components reached only by tab changes receive remount measurements in the component catalog.
	const rendered = await expectShownAttribution(gathered);
	const pages = rendered.filter((id) => registry.find((unit) => unit.id === id)?.kind === 'page');
	expectPageMeasurements(gathered, pages, viewports);
});

/**
 * Every screenshot belongs, as a focused record attributes it, to exactly the visual units it
 * showed at every viewport of its state; the explorer shows each unit with exactly those states;
 * and each visual unit the scenario covers is shown by one. Returns the units so shown.
 */
async function expectShownAttribution(gathered: Gathered[]): Promise<string[]> {
	const always = (views: string[][]) =>
		views.reduce((all, one) => all.filter((id) => one.includes(id)));
	const seen = Object.fromEntries([...shown].map(([state, views]) => [state, always(views)]));
	console.log(JSON.stringify({ observedVisualStates: seen }));
	const screens = gathered.filter(({ line }) => line.kind === 'screenshot');
	const context = { commit: revision, scenarios: [scenario] };
	const { captures: named } = await focusedScreens(screens, evidenceDirectory, context);
	const attributed: Record<string, string[]> = {};
	for (const { unit, capture } of named) {
		const listed = attributed[capture.state] ?? [];
		if (!visual.has(unit) || listed.includes(unit)) continue;
		attributed[capture.state] = [...listed, unit].sort();
	}
	expect.soft(attributed, 'each state is attributed what it showed').toEqual(seen);
	const order = scenario.states.map((state) => state.id);
	const statesOf = (id: string) => order.filter((state) => seen[state]?.includes(id));
	const covered = scenario.units.filter((id) => visual.has(id));
	const units = [...new Set([...covered, ...Object.values(seen).flat()])].sort();
	// The explorer reads only the scenarios that cover a unit, then the states that show it there.
	const resolved = (id: string) => {
		if (!covered.includes(id)) return [];
		return scenarioFor(declared, id, registry).states.map((state) => state.id);
	};
	const shownWith = units.map((id) => [id, statesOf(id)]);
	const message = 'each unit is shown with the states that showed it';
	expect
		.soft(
			units.map((id) => [id, resolved(id)]),
			message
		)
		.toEqual(shownWith);
	const unshown = covered.filter((id) => statesOf(id).length === 0);
	expect.soft(unshown, 'each visual unit the scenario covers is shown by a state').toEqual([]);
	return units.filter((id) => statesOf(id).length > 0);
}
