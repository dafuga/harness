import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { priorImage } from '../../src/utils/planning-collaboration/priorImage';
import type {
	DesignImage,
	DesignOptionInfo,
	DesignVersion
} from '../../src/models/planning-collaboration/DesignVersion.types';

const commitA = '0123456789abcdef0123456789abcdef01234567';
const commitB = '89abcdef0123456789abcdef0123456789abcdef';
const hashA = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const hashB = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const hashC = '431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460';

type Case = { name: string; input: unknown; output: unknown };

function image(viewport: string, sha256: string, state = 'default'): DesignImage {
	return { state, viewport, sha256, bytes: 124800 };
}

function design(
	version: string,
	commit: string | null,
	images: DesignImage[],
	extra: Partial<DesignVersion> = {}
): DesignVersion {
	return {
		version,
		createdAt: '2026-11-10T09:00:00.000Z',
		commit,
		generator: 'codex',
		prompt: 'Refine the header image lighting.',
		baseRevision: commitA,
		images,
		approval: null,
		...extra
	};
}

/** Records the actual calls of one state; its trace file is named by the state id. */
function record(state: string, cases: Case[]) {
	recordExampleCases(
		{
			unitId: 'desktop.function.prior-image',
			symbol: 'priorImage',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const option: DesignOptionInfo = {
	id: 'o1',
	direction: 'warmer light',
	prompt: null,
	revisedPrompt: null,
	generator: 'codex',
	imageHashes: [hashB]
};
const first = design('v1', commitA, [image('desktop', hashA), image('mobile', hashC)]);
const second = design('v2', commitB, [image('desktop', hashB)], {
	revises: { version: 'v1', imageSha256: hashA, region: null, threadId: null }
});

test('returns the exact image a version revises', () => {
	const versions = [first, second];
	const shown = { version: 'v2', image: second.images[0] };
	const withOptions = [first, { ...second, options: [option] }];
	const output = priorImage(versions, shown, commitB);
	const outputWithOptions = priorImage(withOptions, shown, commitB);

	expect(output).toEqual({ version: 'v1', sha256: hashA });
	expect(outputWithOptions).toEqual({ version: 'v1', sha256: hashA });
	record('returns-the-exact-revised-image', [
		{
			name: 'revision binding names v1 and its digest',
			input: { versions, shown, commit: commitB },
			output
		},
		{
			name: 'revision wins over present options',
			input: { versions: withOptions, shown, commit: commitB },
			output: outputWithOptions
		}
	]);
});

test("falls back to the preceding version's same viewport and state", () => {
	const mobile = design('v2', commitB, [image('mobile', hashB)]);
	const shown = { version: 'v2', image: mobile.images[0] };
	const plain = [first, { ...mobile, revises: null, options: [] }];
	const output = priorImage([first, mobile], shown, commitB);
	const outputPlain = priorImage(plain, shown, commitB);

	expect(output).toEqual({ version: 'v1', sha256: hashC });
	expect(outputPlain).toEqual({ version: 'v1', sha256: hashC });
	record('falls-back-to-the-preceding-same-viewport-state', [
		{
			name: 'pair the same mobile default image of v1',
			input: { versions: [first, mobile], shown, commit: commitB },
			output
		},
		{
			name: 'treat a null revision and empty options as single-design',
			input: { versions: plain, shown, commit: commitB },
			output: outputPlain
		}
	]);
});

test('returns null for an option set without a revision', () => {
	const optioned = { ...second, revises: undefined, options: [option] };
	const versions = [first, optioned];
	const shown = { version: 'v2', image: optioned.images[0] };
	const output = priorImage(versions, shown, commitB);

	expect(output).toBeNull();
	record('returns-null-for-an-option-set-without-a-revision', [
		{
			name: 'refuse order pairing for an option set',
			input: { versions, shown, commit: commitB },
			output
		}
	]);
});

test('returns null for a branch view', () => {
	const mobile = design('v2', commitB, [image('mobile', hashB)]);
	const versions = [first, mobile];
	const shown = { version: 'v2', image: mobile.images[0] };
	const output = priorImage(versions, shown, null);

	expect(output).toBeNull();
	record('returns-null-for-a-branch-view', [
		{
			name: 'branch view has no commit to compare',
			input: { versions, shown, commit: null },
			output
		}
	]);
});

test('returns null when no image is shown', () => {
	const versions = [first, second];
	const shown = { version: 'v2', image: undefined };
	const output = priorImage(versions, shown, commitB);

	expect(output).toBeNull();
	record('returns-null-when-no-image-is-shown', [
		{ name: 'undefined selected image', input: { versions, shown, commit: commitB }, output }
	]);
});

test('returns null when the commit does not match the version', () => {
	const versions = [first, second];
	const shown = { version: 'v2', image: second.images[0] };
	const output = priorImage(versions, shown, commitA);

	expect(output).toBeNull();
	record('returns-null-when-the-commit-differs', [
		{ name: 'v1 commit does not select v2', input: { versions, shown, commit: commitA }, output }
	]);
});

test('returns null for a version missing from history', () => {
	const versions = [first];
	const shown = { version: 'v9', image: second.images[0] };
	const output = priorImage(versions, shown, commitB);

	expect(output).toBeNull();
	record('returns-null-for-a-version-missing-from-history', [
		{
			name: 'shown version absent from history',
			input: { versions, shown, commit: commitB },
			output
		}
	]);
});

test('returns null without a same viewport and state prior image', () => {
	const tablet = design('v2', commitB, [image('tablet', hashB)]);
	const hover = design('v2', commitB, [image('desktop', hashB, 'hover')]);
	const tabletShown = { version: 'v2', image: tablet.images[0] };
	const hoverShown = { version: 'v2', image: hover.images[0] };
	const outputTablet = priorImage([first, tablet], tabletShown, commitB);
	const outputHover = priorImage([first, hover], hoverShown, commitB);

	expect(outputTablet).toBeNull();
	expect(outputHover).toBeNull();
	record('returns-null-without-a-matching-prior-image', [
		{
			name: 'no tablet image in the preceding version',
			input: { versions: [first, tablet], shown: tabletShown, commit: commitB },
			output: outputTablet
		},
		{
			name: 'no hover state in the preceding version',
			input: { versions: [first, hover], shown: hoverShown, commit: commitB },
			output: outputHover
		}
	]);
});

test('returns null for a first version without a revision', () => {
	const versions = [first];
	const shown = { version: 'v1', image: first.images[0] };
	const output = priorImage(versions, shown, commitA);

	expect(output).toBeNull();
	record('returns-null-for-a-first-version-without-a-revision', [
		{ name: 'no preceding version exists', input: { versions, shown, commit: commitA }, output }
	]);
});
