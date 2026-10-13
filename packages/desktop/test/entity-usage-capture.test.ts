import { afterEach, expect, test, vi } from 'vitest';
import type { Page, TestInfo } from '@playwright/test';
import type * as Capture from '../../../src/utils/recordCapture';
import { recordCapture } from '../../../src/utils/recordCapture';
import { pictured } from '../tests/e2e/ui-entity-usage-fixture';

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
const sizes = { desktop: [1440, 900], tablet: [920, 1100], mobile: [390, 844] };
/** A page of one size whose renderer carries one stamp; it keeps what was awaited and asked of it. */
function rendered(size: number[] = sizes.desktop, stamp = `harness-build:${build}`) {
	const [waited, shots]: [string[], object[]] = [[], []];
	const page = {
		evaluate: vi.fn(),
		mouse: { move: vi.fn() },
		viewportSize: () => ({ width: size[0], height: size[1] }),
		locator: () => ({ getAttribute: async () => stamp }),
		getByRole: (_role: string, options: { name: string }) => ({
			waitFor: async () => void waited.push(options.name)
		}),
		screenshot: async (options: object) => {
			shots.push(options);
			return Buffer.from('rendered pixels');
		}
	};
	return { page: page as unknown as Page, waited, shots };
}
const info = { outputDir: '/tmp' } as TestInfo;
function verifying() {
	vi.stubEnv('TAKE_SCREENSHOT', '1');
	vi.stubEnv('HARNESS_EVIDENCE_DIR', '/tmp/entity-usage-capture-unit');
	vi.stubEnv('HARNESS_VERIFY', '1');
	vi.stubEnv('HARNESS_VERIFY_REVISION', revision);
}

test('a verification records each picture as the evidence of its state at its viewport', async () => {
	verifying();
	const both = ['Used In', 'Uses'];
	const pictures: [string, keyof typeof sizes, string, string[]][] = [
		['workspace-overview', 'desktop', 'usage-overview', both],
		['workspace-used-in', 'desktop', 'usage-used-in', ['Used In']],
		['workspace-uses', 'desktop', 'usage-uses', ['Uses']],
		['workspace-former-address', 'desktop', 'usage-former-address', both],
		['workspace-nothing-recorded', 'desktop', 'usage-nothing-recorded', both],
		['workspace-overview-tablet', 'tablet', 'usage-overview', both],
		['workspace-overview-mobile', 'mobile', 'usage-overview', both]
	];
	for (const [name, viewport, state, shown] of pictures) {
		const made = rendered(sizes[viewport]);
		await pictured(made.page, info, name);
		expect(recordCapture).toHaveBeenLastCalledWith(
			{
				evidence: `usage-screens-${viewport}`,
				kind: 'screenshot',
				state,
				viewport,
				file: `ui-${state}-${viewport}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId: build, revision },
				note: expect.stringContaining('SYNTHETIC')
			},
			Buffer.from('rendered pixels')
		);
		expect([made.waited, made.shots]).toEqual([
			shown,
			[{ fullPage: true, animations: 'disabled', caret: 'hide' }]
		]);
	}
	expect(recordCapture).toHaveBeenCalledTimes(pictures.length);
});

test('nothing is recorded of an unstamped build, without a revision, or at a size or state not declared', async () => {
	verifying();
	const overview = (size?: number[], stamp?: string) =>
		pictured(rendered(size, stamp).page, info, 'workspace-overview');
	await expect(overview(sizes.desktop, '')).rejects.toThrow(/build/i);
	await expect(overview(sizes.desktop, `harness-build:${'0'.repeat(64)}`)).rejects.toThrow(
		/build/i
	);
	await expect(overview([820, 1180])).rejects.toThrow(/viewport/i);
	const mobile = rendered(sizes.mobile).page;
	await expect(pictured(mobile, info, 'workspace-used-in')).rejects.toThrow(/declared/i);
	vi.stubEnv('HARNESS_VERIFY_REVISION', 'f13f6c5');
	await expect(overview()).rejects.toThrow(/revision/i);
	vi.stubEnv('HARNESS_VERIFY_REVISION', revision);
	vi.stubEnv('HARNESS_VERIFY', '');
	await expect(overview()).rejects.toThrow(/revision/i);
	expect(recordCapture).not.toHaveBeenCalled();
});

test('an ordinary run records nothing, and a picture that stands for no state is no evidence', async () => {
	vi.stubEnv('TAKE_SCREENSHOT', '0');
	vi.stubEnv('HARNESS_EVIDENCE_DIR', '');
	await pictured(rendered().page, info, 'workspace-overview');
	verifying();
	const made = rendered();
	await pictured(made.page, info, 'workspace-sections');
	expect([made.shots, recordCapture]).toEqual([[], expect.not.objectContaining({ calls: [] })]);
	expect(recordCapture).not.toHaveBeenCalled();
});
