import { expect, test } from 'vitest';
import { priorImage } from '../../src/components/design-panel/priorImage';
import type { DesignVersion } from '../../src/models/Desktop.types';

const first = 'c'.repeat(40);
const second = 'a'.repeat(40);
const image = (viewport: string, sha: string) => ({
	file: `${sha}-default-${viewport}.png`,
	state: 'default',
	viewport,
	sha256: sha.repeat(64),
	bytes: 1
});
const versions = [
	{ version: 'v001', commit: first, images: [image('desktop', '1'), image('mobile', '2')] },
	{ version: 'v002', commit: second, images: [image('desktop', '3'), image('tablet', '4')] }
] as unknown as DesignVersion[];
const shown = (version: string, index: number) => ({
	version,
	image: versions.find((item) => item.version === version)?.images[index]
});

test('the commit that introduced a version is compared with the image it replaced', () => {
	expect(priorImage(versions, shown('v002', 0), second)).toEqual({
		version: 'v001',
		sha256: '1'.repeat(64)
	});
});

test('a branch view compares nothing and shows its one current image', () => {
	expect(priorImage(versions, shown('v002', 0), null)).toBeNull();
});

test('nothing is compared where the data does not support it', () => {
	expect(priorImage(versions, shown('v002', 0), first)).toBeNull();
	expect(priorImage(versions, shown('v002', 1), second)).toBeNull();
	expect(priorImage(versions, shown('v001', 0), first)).toBeNull();
	expect(priorImage(versions, { version: 'v002', image: undefined }, second)).toBeNull();
	expect(priorImage(versions, shown('v009', 0), second)).toBeNull();
});

test('a version of options compares with the exact image it revises, never by option order', () => {
	const shown = {
		file: 'o1-default-desktop.png',
		state: 'default',
		viewport: 'desktop',
		sha256: 'new-o1',
		bytes: 1,
		option: 'o1'
	};
	const before = {
		...{ version: 'v002', createdAt: '', commit: 'c1', generator: 'GPT Image', prompt: '' },
		...{ baseRevision: '', approval: null },
		images: [
			{ ...shown, sha256: 'old-o1' },
			{ ...shown, sha256: 'old-o2', option: 'o2' }
		]
	} as DesignVersion;
	const revises = {
		version: 'v002',
		imageSha256: 'old-o2',
		option: 'o2',
		region: null,
		threadId: null
	};
	const after = {
		...before,
		version: 'v003',
		commit: 'c2',
		images: [shown],
		revises
	} as DesignVersion;
	const options = [
		{ id: 'o1', direction: '', prompt: null, revisedPrompt: null, generator: '', imageHashes: [] }
	];
	expect(priorImage([before, after], { version: 'v003', image: shown }, 'c2')).toEqual({
		version: 'v002',
		sha256: 'old-o2'
	});
	const unrecorded = { ...after, revises: null, options } as DesignVersion;
	expect(priorImage([before, unrecorded], { version: 'v003', image: shown }, 'c2')).toBeNull();
});
