import { expect } from 'vitest';
import { galleryItems, catalogShot } from '../../src/utils/explorer-ui/entityScreens';
import { commits, ids } from '../entityUnits';
import type { HarnessUnit } from '../../src/models/explorer-ui/Harness.types';
import type { Revision } from './entity-screens.test.types';
import { explorerEvidence } from '../../src/utils/explorer-ui/explorerEvidence';
import { scope } from '../entityPlaces';
import type { ExplorerEvidence } from '../../src/models/explorer-ui/Explorer.types';

/** What the host gives for the page: the tip alone, or a commit beside the parent it names. */
export function evidence(page: HarnessUnit, shown: Revision, parent?: Revision | null) {
	if (parent === undefined)
		return explorerEvidence(scope('current'), { head: shown, parent: null }, page);
	const at = { ...scope('commit'), parent: parent ? parent.commit : null };
	return explorerEvidence(at, { head: shown, parent }, page);
}

/** Video projection keeps the same frozen gallery assertions out of the case inventory. */
export function assertVideoProjection(page: HarnessUnit, tip: Revision) {
	const video = structuredClone(evidence(page, tip));
	const original = video.after.captures[0];
	video.after.captures.push({
		...original,
		recordId: 'f'.repeat(64),
		capture: {
			...original.capture,
			evidence: 'motion',
			kind: 'video',
			mediaType: 'video/mp4',
			media: 'media/clip.mp4',
			video: { clipId: 'spinner', unit: ids.page, inputHash: 'd'.repeat(64) }
		} as never
	});
	const clip = galleryItems(video).find((item) => item.mediaType === 'video');
	expect(clip).toMatchObject({
		file: 'clip.mp4',
		mediaType: 'video',
		video: {
			reference: {
				record: 'f'.repeat(64),
				revision: commits.tip,
				unit: ids.page,
				clipId: 'spinner',
				viewport: original.capture.viewport
			},
			sha256: original.capture.sha256,
			inputHash: 'd'.repeat(64),
			selectedRevision: commits.tip,
			freshness: 'current'
		}
	});
	expect(catalogShot(video)?.mimeType).not.toBe('video/mp4');
	assertInheritedVideoProjection(video);
	video.after.captures.at(-1)!.capture.videoReference = {
		batch: 'b'.repeat(64),
		record: 'c'.repeat(64),
		revision: commits.first
	};
	expect(galleryItems(video).find((item) => item.mediaType === 'video')).toMatchObject({
		video: {
			reference: { record: 'c'.repeat(64), revision: commits.first },
			freshness: 'inherited',
			selectedRevision: commits.tip
		}
	});
	return video;
}

function assertInheritedVideoProjection(video: ExplorerEvidence) {
	const inheritedVideo = structuredClone(video);
	const inheritedClip = inheritedVideo.after.captures.at(-1)!;
	inheritedClip.current = false;
	inheritedClip.inheritedFrom = commits.first;
	inheritedClip.capture.server!.revision = commits.first;
	const source = inheritedVideo.after.record!;
	source.id = 'f'.repeat(64);
	const result = source.scenarios.find((item) => item.id === inheritedClip.scenario)!;
	result.inherited = true;
	result.status = 'referenced';
	result.testedRevision = commits.first;
	result.origin = { record: 'a'.repeat(64), commit: commits.first };
	expect(galleryItems(inheritedVideo).find((item) => item.mediaType === 'video')).toMatchObject({
		video: {
			reference: { record: 'a'.repeat(64), revision: commits.first },
			selectedRevision: commits.tip,
			freshness: 'inherited'
		}
	});
}

export function assertVideoSlots(evidence: ExplorerEvidence) {
	const several = structuredClone(evidence),
		first = several.after.captures.at(-1)!;
	several.after.captures.push({
		...first,
		capture: { ...first.capture, video: { ...first.capture.video!, clipId: 'spinner-secondary' } }
	});
	const items = galleryItems(several).filter((item) => item.mediaType === 'video');
	expect(
		new Set(items.map((item) => item.id)).size,
		'independent clip IDs keep distinct gallery slots'
	).toBe(2);
	for (const item of items) expect(item.title).toContain(item.video!.clipId);
}

/** Exercise persisted captures before revision projection, including clips sharing a state. */
export function assertRecordedVideoSlots(page: HarnessUnit, tip: Revision) {
	const persisted = structuredClone(tip),
		newest = persisted.records[0];
	newest.id = 'f'.repeat(64);
	const state = newest.scenarios.find((scenario) => scenario.id === 'orders-page')!.states[0];
	const shots = [...state.captures, { ...state.captures[0], viewport: 'tablet' }];
	persisted.registry.scenarios
		.find((scenario) => scenario.id === 'orders-page')!
		.viewports!.push({
			id: 'tablet',
			width: 834,
			height: 1112
		});
	state.captures.push(
		...Array.from({ length: 16 }, (_, index) =>
			shots.map(
				(shot) =>
					({
						...shot,
						evidence: 'motion',
						kind: 'video',
						mediaType: 'video/mp4',
						media: `media/search-${index}-${shot.viewport}.mp4`,
						video: { clipId: `search-${index}`, unit: ids.page, inputHash: 'd'.repeat(64) }
					}) as never
			)
		).flat()
	);
	const older = structuredClone(newest);
	older.id = 'e'.repeat(64);
	older.finishedAt = '2026-10-09T09:00:00.000Z';
	persisted.records.push(older);
	const projected = evidence(page, persisted);
	const clips = galleryItems(projected).filter((item) => item.mediaType === 'video');
	expect(
		clips,
		'all16 persisted branches survive revision projection at all3 viewports'
	).toHaveLength(48);
	expect(new Set(clips.map((item) => item.id)).size).toBe(48);
	expect(new Set(clips.map((item) => item.video!.reference?.record))).toEqual(new Set([newest.id]));
	for (let index = 0; index < 16; index++) {
		expect(clips.filter((item) => item.video!.clipId === `search-${index}`)).toHaveLength(3);
	}
}
