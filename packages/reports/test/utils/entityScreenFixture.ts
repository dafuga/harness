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
