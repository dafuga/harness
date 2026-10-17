import { runtimeEvidence, runtimeAudio } from './runtime-evidence';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import {
	branch,
	commits,
	evidenceData,
	evidenceFixture,
	evidenceRelease,
	evidenceState,
	ids,
	sharedProject,
	soundScenario
} from './ui-evidence-fixture';

/**
 * What a function or a service did end to end, as its recorded results say once their bytes
 * were read through the bridge and checked: one run at a branch tip, both runs at a commit. A
 * change is said only of what both results hold, never of bytes that merely differ.
 */
const short = (commit: string) => commit.slice(0, 7);
const at = (entity: string, commit?: string) =>
	`/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}` +
	`${commit ? `/commit/${commit}` : ''}/${entity}`;
const filter = `functions/${ids.filter}`;
const runtime = (page: Page) => page.getByRole('region', { name: 'Recorded runtime evidence' });
const verdict = (page: Page) => runtime(page).getByRole('status');
/** The recorded output of the matching search at the tip, as the synthetic history sealed it. */
function tipOutput() {
	const found = evidenceData().results[`${ids.filter}|commit|${commits.tip}`];
	const row = found.behavior.rows.find((item) => item.state === 'match' && item.kind === 'output');
	return row!.after!.sha256;
}

test('a function at its branch tip shows the one run that was recorded, with what it was asked and answered', async ({
	page
}, info) => {
	await evidenceFixture(page);
	await page.goto(at(filter));
	const shown = runtime(page);
	await expect(shown.getByRole('heading', { name: 'Current end-to-end behavior' })).toBeVisible();
	await expect(verdict(page)).toHaveText('Current behavior');
	const run = shown.getByRole('group', { name: `Current snapshot · ${short(commits.tip)}` });
	await expect(run.getByText('Branch tip', { exact: true })).toBeVisible();
	await expect(run.getByText('Search across synthetic orders · match')).toBeVisible();
	const output = run.getByRole('group', { name: 'output of match' });
	await expect(output.getByText('Search text', { exact: true })).toBeVisible();
	await expect(output.getByText('SERVICE', { exact: true })).toBeVisible();
	await expect(output.getByText('Order 1042 · Service call')).toBeVisible();
	await expect(output.getByText('Order 1077 · Service plan')).toBeVisible();
	await output.getByText('Assertions and recorded result').click();
	await expect(output.getByText('Matching order is listed')).toBeVisible();
	await expect(shown.getByText(/Before ·|After ·/)).toHaveCount(0);
	await expect(shown.getByRole('heading', { name: /screenshot/i })).toHaveCount(0);
	await runtimeEvidence(page, info, 'function-current');
	const { calls } = await evidenceState(page);
	const read = calls.filter((call) => call.op === 'artifact');
	expect(read.map((call) => [call.state, call.evidenceId, call.viewport]).sort()).toEqual([
		['match', 'assertions', null],
		['match', 'output', null],
		['no-match', 'assertions', null]
	]);
	expect(new Set(read.map((call) => `${call.side}|${call.mode}|${call.recordId}`))).toEqual(
		new Set(['after|current|rec-cccccc-0000'])
	);
});

test('a commit says what changed in the behaviour only once both results were read', async ({
	page
}, info) => {
	await evidenceFixture(page, { hold: true });
	await page.goto(at(filter, commits.tip));
	const shown = runtime(page);
	await expect(shown.getByRole('heading', { name: 'End-to-end comparison' })).toBeVisible();
	// The bytes of the two sides differ, and none was read yet: nothing is called a change.
	await expect(verdict(page)).toHaveText('Reading the recorded results…');
	await expect(shown.getByText(/Behavior changed|Behavior unchanged/)).toHaveCount(0);
	await evidenceRelease(page);
	await expect(verdict(page)).toHaveText('Behavior changed');
	await expect(shown.getByText('match: the recorded output changed at output[1]')).toBeVisible();
	const before = shown.getByRole('group', { name: `Before · ${short(commits.middle)}` });
	const after = shown.getByRole('group', { name: `After · ${short(commits.tip)}` });
	await expect(before.getByText('Parent commit', { exact: true })).toBeVisible();
	await expect(after.getByText('Selected commit', { exact: true })).toBeVisible();
	await expect(after.getByText('differs at output[1]')).toBeVisible();
	const was = before.getByRole('group', { name: 'output of match' });
	const is = after.getByRole('group', { name: 'output of match' });
	await expect(was.getByText('Order 1042 · Service call')).toBeVisible();
	await expect(was.getByText('Order 1077 · Service plan')).toHaveCount(0);
	await expect(is.getByText('Order 1077 · Service plan')).toBeVisible();
	// Two runs that differ only in when they were taken are the same behaviour.
	await expect(shown.getByText(/assertions (changed|differs)/)).toHaveCount(0);
	await runtimeEvidence(page, info, 'function-commit');
});

test('bytes that do not have the recorded hash are not read, and the behaviour stays unknown', async ({
	page
}, info) => {
	await evidenceFixture(page, { corrupt: [tipOutput()] });
	await page.goto(at(filter, commits.tip));
	const shown = runtime(page);
	await expect(verdict(page)).toHaveText('Behavior unknown');
	const after = shown.getByRole('group', { name: `After · ${short(commits.tip)}` });
	const output = after.getByRole('group', { name: 'output of match' });
	await expect(
		output.getByText('The bytes that were read do not have the recorded SHA-256.')
	).toBeVisible();
	await expect(output.getByText('Order 1077 · Service plan')).toHaveCount(0);
	await expect(shown.getByText('Behavior changed')).toHaveCount(0);
	await expect(
		shown.getByText('A recorded result could not be read and checked, so it is not compared.')
	).toBeVisible();
	await runtimeEvidence(page, info, 'behavior-unknown');
});

test('a request the backend refuses is shown as refused, never as an empty result', async ({
	page
}, info) => {
	await evidenceFixture(page, { moved: true });
	await page.goto(at(filter));
	const shown = runtime(page);
	const refusal = 'The pinned evidence changed; read the entity again.';
	await expect(shown.getByText(refusal).first()).toBeVisible();
	await expect(shown.getByText('Order 1042 · Service call')).toHaveCount(0);
	await page.goto(at(`pages/${ids.page}`));
	const current = shown.getByRole('figure', { name: `Current snapshot · ${short(commits.tip)}` });
	await expect(current.getByText(refusal)).toBeVisible();
	await expect(current.getByRole('img')).toHaveCount(0);
	await runtimeEvidence(page, info, 'refused');
});

test('a clip is played from checked bytes: one at the tip, and at a commit its absence is said', async ({
	page
}, info) => {
	await evidenceFixture(page);
	await page.goto(at(`components/${ids.search}`));
	const shown = runtime(page);
	await expect(shown.getByRole('heading', { name: 'Current audio' })).toBeVisible();
	const clip = shown.getByLabel(`${soundScenario} · announced`, { exact: true });
	await expect(clip).toHaveAttribute('src', /^blob:/);
	await expect
		.poll(() => clip.evaluate((node: HTMLAudioElement) => Math.round(node.duration)))
		.toBe(1);
	await expect(shown.getByText('Order filed.')).toBeVisible();
	await clip.evaluate((audio: HTMLAudioElement) => audio.play());
	await expect
		.poll(() => clip.evaluate((audio: HTMLAudioElement) => audio.currentTime))
		.toBeGreaterThan(0);
	await clip.evaluate((audio: HTMLAudioElement) => audio.pause());
	await runtimeEvidence(page, info, 'audio-current');
	await runtimeAudio(page);
	await page.goto(at(`components/${ids.search}`, commits.tip));
	await expect(shown.getByRole('heading', { name: 'Audio before and after' })).toBeVisible();
	await expect(
		shown.getByText(`No clip of this state is recorded for ${short(commits.middle)}.`)
	).toBeVisible();
	await expect(shown.getByLabel(`${soundScenario} · announced`, { exact: true })).toHaveCount(1);
	await runtimeEvidence(page, info, 'audio-commit');
	// A unit with no declared clip is not given an audio section at all.
	await page.goto(at(`pages/${ids.page}`));
	await expect(shown.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await expect(shown.getByRole('heading', { name: /audio/i })).toHaveCount(0);
});
