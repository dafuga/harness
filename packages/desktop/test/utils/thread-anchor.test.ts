import { expect, test } from 'vitest';
import {
	designTarget,
	entityTarget,
	imageTarget,
	sameImage,
	threadAnchor
} from '../../src/utils/threadAnchor';
import type { DesignVersion } from '../../src/models/Desktop.types';

const image = { state: 'default', viewport: 'desktop', sha256: 'b'.repeat(64), bytes: 10 };
const revision = { branch: 'feat/x', commit: 'c'.repeat(40), tip: 'a'.repeat(40), atTip: false };

test('an image target binds the exact version, image, state and viewport', () => {
	const region = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
	expect(imageTarget('v002', image, region)).toEqual({
		version: 'v002',
		imageSha256: image.sha256,
		state: 'default',
		viewport: 'desktop',
		region
	});
});

test('a design without an image is commented on as the entity, never with a made-up image', () => {
	const headless = { version: 'v001', images: [] } as unknown as DesignVersion;
	expect(designTarget(headless)).toEqual(entityTarget);
	expect(designTarget(undefined)).toEqual(entityTarget);
	const designed = { version: 'v002', images: [image] } as unknown as DesignVersion;
	expect(designTarget(designed)).toEqual(imageTarget('v002', image, null));
});

test('an anchor names the viewed branch and commit, also a historical one', () => {
	expect(threadAnchor(revision, 'page:a', imageTarget('v002', image, null))).toEqual({
		branch: 'feat/x',
		commit: 'c'.repeat(40),
		entityId: 'page:a',
		version: 'v002',
		imageSha256: image.sha256,
		state: 'default',
		viewport: 'desktop',
		region: null
	});
});

test('threads belong to one image by version and hash', () => {
	const target = imageTarget('v002', image, null);
	expect(sameImage(target, { ...target, region: { x: 0, y: 0, width: 1, height: 1 } })).toBe(true);
	expect(sameImage(target, { ...target, version: 'v001' })).toBe(false);
	expect(sameImage(target, entityTarget)).toBe(false);
	expect(sameImage(null, target)).toBe(false);
	expect(sameImage(entityTarget, entityTarget)).toBe(false);
});
