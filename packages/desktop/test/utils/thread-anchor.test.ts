import { expect, test } from 'vitest';
import {
	designOption,
	entityTarget,
	imageTarget,
	optionImages
} from '../../src/utils/threadAnchor';
import {
	designTarget,
	otherOption,
	shownApproval,
	threadAnchor
} from '../../src/components/thread-panel/threadAnchor';
import { sameImage } from '../../src/components/thread-links/threadAnchor';
import { versionOption } from '../../src/components/entity-view/threadAnchor';
import type { DesignVersion } from '../../src/models/Desktop.types';

const image = { file: 'o1-default-desktop.png', state: 'default', viewport: 'desktop', sha256: 'b'.repeat(64), bytes: 10 };
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

/** Two options of one version: o2 holds a desktop and a phone image. */
const picture = (sha256: string, option: string, viewport = 'desktop') => ({
	file: `${option}-default-${viewport}.png`,
	state: 'default',
	viewport,
	sha256,
	bytes: 1,
	option
});
const options = {
	...{ version: 'v003', createdAt: '', commit: null, generator: 'GPT Image', prompt: '' },
	...{ baseRevision: '', approval: null },
	images: [picture('a1', 'o1'), picture('a2', 'o2'), picture('a2p', 'o2', 'phone')],
	options: ['o1', 'o2'].map((id) => ({
		...{ id, direction: id, prompt: null, revisedPrompt: null, generator: 'GPT Image' },
		imageHashes: []
	}))
} as DesignVersion;
const approvedO2 = {
	...options,
	approval: {
		...{ id: 'a', version: 'v003', imageHashes: ['a2', 'a2p'], contractHash: 'c' },
		...{ approvedAt: '', current: true, option: 'o2' }
	}
} as DesignVersion;
const single = { ...options, options: undefined, images: [image] } as DesignVersion;

test('an option is exactly its own images, and a single design keeps all of its images', () => {
	expect(optionImages(options, 'o2').map((item) => item.sha256)).toEqual(['a2', 'a2p']);
	expect(optionImages(options, 'o9')).toEqual([]);
	expect(optionImages(single, 'o1')).toEqual([image]);
});

test('the option shown is the one chosen, else the approved one, else the first', () => {
	expect(designOption(options, 'o2')).toBe('o2');
	expect(designOption(options, 'o9')).toBe('o1');
	expect(designOption(approvedO2)).toBe('o2');
	expect(
		designOption({ ...approvedO2, approval: { ...approvedO2.approval!, current: false } })
	).toBe('o1');
	expect(designOption(single, 'o1')).toBe('');
	expect(versionOption([{ ...single, version: 'v002' }, approvedO2], 'v003')).toBe('o2');
});

test('only the option approved with exactly its images is approved, and only at the latest version', () => {
	expect(shownApproval(approvedO2, 'v003', 'o2')).toBe(true);
	expect(shownApproval(approvedO2, 'v003', 'o1')).toBe(false);
	expect(shownApproval(approvedO2, 'v004', 'o2')).toBe(false);
	const partial = { ...approvedO2.approval!, imageHashes: ['a2'] };
	expect(shownApproval({ ...approvedO2, approval: partial }, 'v003', 'o2')).toBe(false);
	const legacy = { ...single, approval: { ...approvedO2.approval!, option: undefined } };
	expect(shownApproval(legacy, 'v003')).toBe(true);
	expect(shownApproval(options, 'v003', 'o1')).toBe(false);
});

test('a new thread aims at the first image of the option shown and names that option', () => {
	expect(designTarget(options, 'o2')).toEqual({
		...{ version: 'v003', imageSha256: 'a2', state: 'default', viewport: 'desktop' },
		...{ region: null, option: 'o2' }
	});
	expect(designTarget(single)).not.toHaveProperty('option');
	const thread = { ...designTarget(options, 'o1') };
	expect(otherOption(thread, 'v003', 'o2')).toBe(true);
	expect(otherOption(thread, 'v003', 'o1')).toBe(false);
	expect(otherOption(thread, 'v004', 'o2')).toBe(false);
	expect(otherOption(designTarget(single), 'v003', 'o2')).toBe(false);
});
