import { afterEach, expect, test, vi } from 'vitest';
import type { Page, TestInfo } from '@playwright/test';
import type * as Capture from '../../../src/utils/recordCapture';
import { recordCapture } from '../../../src/utils/recordCapture';
import { runtimeAudio, runtimeEvidence } from '../tests/e2e/runtime-evidence';
import { evidenceData, recordedClip } from '../tests/e2e/ui-evidence-fixture';

vi.mock('../../../src/utils/recordCapture', async (original) => ({
	...(await original<typeof Capture>()),
	recordCapture: vi.fn()
}));
afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});
const build = '1234567890abcdef'.repeat(4);
const revision = 'abcdef1234'.repeat(4);
/** `played` stands for what the page's one clip plays; a browser run reads the real object. */
function page(stamp = `harness-build:${build}`, width = 1440, played: number[] = []): Page {
	return {
		evaluate: vi.fn(),
		mouse: { move: vi.fn() },
		viewportSize: () => ({ width, height: 900 }),
		locator: () => ({ getAttribute: async () => stamp, evaluate: async () => played }),
		screenshot: async () => Buffer.from('captured pixels')
	} as unknown as Page;
}
const info = { outputPath: (name: string) => `/tmp/${name}` } as TestInfo;
function requested() {
	vi.stubEnv('TAKE_SCREENSHOT', '1');
	vi.stubEnv('HARNESS_EVIDENCE_DIR', '/tmp/runtime-evidence-unit');
	vi.stubEnv('HARNESS_VERIFY', '1');
	vi.stubEnv('HARNESS_VERIFY_REVISION', revision);
}
test('capture records the rendered build and outer verification revision, with explicit fixture boundaries', async () => {
	requested();
	await runtimeEvidence(page(), info, 'current');
	expect(recordCapture).toHaveBeenCalledWith(
		expect.objectContaining({
			evidence: 'runtime-screens-desktop',
			state: 'current',
			viewport: 'desktop',
			provenance: 'actual-capture',
			server: { buildId: build, revision },
			note: expect.stringContaining('SYNTHETIC')
		}),
		Buffer.from('captured pixels')
	);
});
test('an unstamped renderer, absent verification revision, and undeclared viewport cannot produce evidence', async () => {
	requested();
	await expect(runtimeEvidence(page(''), info, 'current')).rejects.toThrow(/build/i);
	await expect(runtimeEvidence(page(undefined, 1000), info, 'current')).rejects.toThrow(
		/viewport/i
	);
	vi.stubEnv('HARNESS_VERIFY_REVISION', '');
	await expect(runtimeEvidence(page(), info, 'current')).rejects.toThrow(/revision/i);
	expect(recordCapture).not.toHaveBeenCalled();
});
test('ordinary runs do not emit verification evidence and unknown states are refused', async () => {
	vi.stubEnv('TAKE_SCREENSHOT', '0');
	vi.stubEnv('HARNESS_EVIDENCE_DIR', '');
	await runtimeEvidence(page(), info, 'current');
	expect(recordCapture).not.toHaveBeenCalled();
	requested();
	await expect(runtimeEvidence(page(), info, 'invented')).rejects.toThrow(/state/i);
	expect(recordCapture).not.toHaveBeenCalled();
});
test('the clip is kept as the exact bytes the sealed history records for it', async () => {
	requested();
	const data = evidenceData();
	const clip = data.bytes[recordedClip(data)].data;
	await runtimeAudio(page(undefined, undefined, clip));
	expect(recordCapture).toHaveBeenCalledWith(
		expect.objectContaining({
			evidence: 'runtime-audio-fixture',
			kind: 'audio',
			state: 'audio-current',
			mediaType: 'audio/wav',
			provenance: 'fixture',
			server: { buildId: build, revision },
			transcript: expect.stringContaining('silence')
		}),
		Uint8Array.from(clip)
	);
});
test('bytes that are not the recorded clip are never kept as it', async () => {
	requested();
	const data = evidenceData();
	const clip = data.bytes[recordedClip(data)].data;
	const damaged = clip.map((value, at) => (at === clip.length - 1 ? value ^ 1 : value));
	const picture = Object.values(data.bytes).find((kept) => kept.mediaType === 'image/png')!.data;
	for (const other of [damaged, clip.slice(0, -1), picture, []])
		await expect(runtimeAudio(page(undefined, undefined, other))).rejects.toThrow(
			/recorded SHA-256/
		);
	expect(recordCapture).not.toHaveBeenCalled();
});

// These modeled capture descriptors exercise the real scenario gate, not renderer pixels.
test('the runtime scenario refuses missing current, comparison, inherited and audio evidence', async () => {
	const { scenarioManifestSchema } = await import('../../../src/core/unitTypes');
	const { scenarioCoverage } = await import('../../../src/utils/scenarioCoverage');
	const { readFileSync } = await import('node:fs');
	const scenario = scenarioManifestSchema.parse(
		JSON.parse(
			readFileSync(
				new URL('../../../specification/scenarios/runtime-evidence-ui.json', import.meta.url),
				'utf8'
			)
		)
	);
	const empty = scenarioCoverage({ scenario, commit: revision, gathered: [], checkFailed: false });
	for (const state of [
		'current',
		'commit',
		'inherited',
		'missing',
		'function-current',
		'function-commit',
		'audio-current',
		'old-host-gap',
		'phone-gap',
		'regression-proof',
		'regression-proof-output',
		'regression-proof-before'
	])
		expect(empty.failures.some((item) => item.includes(`state ${state}`))).toBe(true);
	expect(empty.failures).toHaveLength(36);
});
