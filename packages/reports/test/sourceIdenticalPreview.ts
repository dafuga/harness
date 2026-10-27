import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { expect } from 'vitest';
import { catalogShot, galleryItems } from '../src/utils/entityScreens';
import { explorerEvidence } from '../src/utils/explorerEvidence';
import { measureWorkload } from '../../../test/support/measureWorkload';
import { expectClassAudioMatrix, focusedAudioFixture } from './focusedAudioExamples';
import { scope } from './entityPlaces';
import { withFocused } from './entityStates';
import { commits, ids } from './entityUnits';

/** Exercise retained focused captures through their real explorer selection boundary. */
export async function expectSourceIdenticalPreview(
	head: HarnessRevision,
	tip: HarnessRevision,
	page: HarnessUnit
) {
	const captured = withFocused(head, ids.page);
	const sourceTree = 'e'.repeat(40);
	const point = { ...captured.regressions![0].green!, sourceTree };
	const squashed = {
		...captured,
		commit: commits.tip,
		side: `sides/${sourceTree}.json`,
		regressions: [{ ...captured.regressions![0], green: point }]
	};
	const view = (revision: HarnessRevision) =>
		explorerEvidence(scope('current'), { head: revision, parent: null }, page);
	const found = view(squashed);
	expect(catalogShot(found), 'source-identical squash displays original screenshot').not.toBeNull();
	expect(catalogShot(found)?.source).toBe(commits.middle);
	expect(
		found.after.captures.every((item) => !item.current && item.inheritedFrom === commits.middle)
	).toBe(true);
	expect(catalogShot(view({ ...squashed, side: `sides/${'f'.repeat(40)}.json` }))).toBeNull();
	await measureWorkload(
		'reports.function.explorer-evidence-focused-captures',
		'focused-audio-binding-matrix',
		() => expectClassAudioMatrix(head, tip, sourceTree)
	);
	const audio = focusedAudioFixture(head);
	const run = audio.detail.regressions![0];
	const inherited = {
		...audio.detail,
		commit: commits.tip,
		side: `sides/${sourceTree}.json`,
		regressions: [{ ...run, green: { ...run.green!, sourceTree } }]
	};
	const clips = galleryItems(
		explorerEvidence(scope('current'), { head: inherited, parent: null }, audio.unit)
	);
	expect(clips).toHaveLength(1);
	expect(clips[0].source).toBe(commits.middle);
	expect(clips[0].comparison).toContain('generate.initialized');
	expect(clips[0].note).toContain('tested revision');
}
