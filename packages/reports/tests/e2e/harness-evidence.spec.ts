import { expect, test } from '../../../../test/support/browserTest';
import { readFileSync, rmSync } from 'node:fs';
import { scenarioManifestSchema } from '../../../../src/core/unitTypes';
import { gatherCaptures } from '../../../../src/services/check-run-service/gatherCaptures';
import { scenarioCoverage } from '../../../../src/services/verification-service/scenarioCoverage';
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
import { expectPageMeasurements, pageUnit } from './support/pageBenchmark';

const scenario = scenarioManifestSchema.parse(
	JSON.parse(readFileSync('../../specification/scenarios/harness-console.json', 'utf8'))
);

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
	expectPageMeasurements(
		gathered,
		scenario.states
			.flatMap((state) => state.units ?? [])
			.filter((unit) => unit.startsWith('reports.page.')),
		viewports
	);
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
});
