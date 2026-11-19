import { test } from 'vitest';
import type {
	DesignImage,
	DesignVersion
} from '../../src/models/development-tooling/Desktop.types';
import { versionOption } from '../../src/components/explorer-ui/entity-view/threadAnchor';
import { entityTarget, imageTarget } from '../../src/utils/explorer-ui/threadAnchor';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const commit = '0123456789abcdef0123456789abcdef01234567';
const hashA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const hashB = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

function option(id: string) {
	return {
		id,
		direction: `direction ${id}`,
		prompt: null,
		revisedPrompt: null,
		generator: 'image-generator',
		imageHashes: [hashA]
	};
}

const base = {
	createdAt: '2026-11-15T12:00:00.000Z',
	commit,
	generator: 'image-generator',
	prompt: 'Design a compact dashboard header.',
	baseRevision: '89abcdef0123456789abcdef0123456789abcdef'
};

const v11: DesignVersion = {
	...base,
	version: 'v11',
	images: [{ state: 'approved', viewport: 'desktop', sha256: hashA, bytes: 184320, option: 'o1' }],
	approval: null,
	options: [option('o1'), option('o2')]
};

const v12: DesignVersion = {
	...base,
	version: 'v12',
	images: [{ state: 'approved', viewport: 'desktop', sha256: hashA, bytes: 184320, option: 'o2' }],
	approval: {
		id: 'a9f0c2e4-61b7-4d3a-8e25-7c1f0b9d4e63',
		version: 'v12',
		imageHashes: [hashA],
		contractHash: 'c3a1e7f9d2b40658a1e3c7f9d2b4065ca1e3c7f9d2b4065ca1e3c7f9d2b40658',
		approvedAt: '2026-11-16T08:30:00.000Z',
		current: true,
		option: 'o2'
	},
	options: [option('o1'), option('o2')]
};

const v13: DesignVersion = {
	...base,
	version: 'v13',
	images: [{ state: 'draft', viewport: 'desktop', sha256: hashB, bytes: 1200 }],
	approval: null
};

const duplicateV12: DesignVersion = { ...v12, options: [option('o1')], approval: null };
const versions = [v11, v12, v13];

function versionCase(name: string, input: DesignVersion[], version: string, expected: string) {
	const output = versionOption(input, version);
	expect(output).toBe(expected);
	return { name, input: { versions: input, version }, output };
}

test('Selects the exact version and its current option', () => {
	const cases = [
		versionCase('use the current approved option of the exact version', versions, 'v12', 'o2'),
		versionCase(
			'use the first option when the version has no current approval',
			versions,
			'v11',
			'o1'
		),
		versionCase('return the empty string for a version without options', versions, 'v13', ''),
		versionCase('match the version exactly and not by prefix', versions, 'v1', ''),
		versionCase('use only the first duplicate of a version', [duplicateV12, v12], 'v12', 'o1')
	];
	recordExampleCases(
		{
			unitId: 'desktop.function.thread-anchor',
			symbol: 'versionOption',
			state: 'selects-the-exact-version-and-its-current-option',
			evidence: 'examples-cases',
			file: 'selects-the-exact-version-and-its-current-option.json'
		},
		cases
	);
});

test('Builds the entity-wide target with null fields', () => {
	expect(entityTarget).toEqual({
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	});
	expect(entityTarget).not.toHaveProperty('option');
	recordExampleCases(
		{
			unitId: 'desktop.function.thread-anchor',
			symbol: 'entityTarget',
			state: 'builds-the-entity-wide-target-with-null-fields',
			evidence: 'examples-cases',
			file: 'builds-the-entity-wide-target-with-null-fields.json'
		},
		[
			{
				name: 'entity-wide target has null version, hash, state, viewport and region',
				input: {},
				output: entityTarget
			}
		]
	);
});

test('Builds image targets with an option only when it is truthy', () => {
	const region = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
	const optioned: DesignImage = {
		state: 'approved',
		viewport: 'desktop',
		sha256: hashA,
		bytes: 184320,
		option: 'o2'
	};
	const plain: DesignImage = { state: 'draft', viewport: 'mobile', sha256: hashB, bytes: 1200 };
	const emptyOption: DesignImage = { ...plain, option: '' };
	const withOption = imageTarget('v12', optioned, region);
	const withoutOption = imageTarget('v13', plain, null);
	const withEmptyOption = imageTarget('v13', emptyOption, null);

	expect(withOption).toEqual({
		version: 'v12',
		imageSha256: hashA,
		state: 'approved',
		viewport: 'desktop',
		region,
		option: 'o2'
	});
	expect(withoutOption).toEqual({
		version: 'v13',
		imageSha256: hashB,
		state: 'draft',
		viewport: 'mobile',
		region: null
	});
	expect(withoutOption).not.toHaveProperty('option');
	expect(withEmptyOption).not.toHaveProperty('option');
	recordExampleCases(
		{
			unitId: 'desktop.function.thread-anchor',
			symbol: 'imageTarget',
			state: 'builds-image-targets-with-an-option-only-when-truthy',
			evidence: 'examples-cases',
			file: 'builds-image-targets-with-an-option-only-when-truthy.json'
		},
		[
			{
				name: 'include the truthy image option with the supplied region',
				input: { version: 'v12', image: optioned, region },
				output: withOption
			},
			{
				name: 'omit the option key when the image has none',
				input: { version: 'v13', image: plain, region: null },
				output: withoutOption
			},
			{
				name: 'omit the option key when the image option is empty',
				input: { version: 'v13', image: emptyOption, region: null },
				output: withEmptyOption
			}
		]
	);
});
