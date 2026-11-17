import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { topLayout, scrolledLayout } from '../../scripts/ios-acceptance-layout';
import type { Measured } from '../../scripts/ios-acceptance-layout.types';

vi.mock('../../scripts/ios-acceptance-run', () => ({ shot: vi.fn(async () => undefined) }));

function acceptance(result: Measured, checks: boolean[]) {
	const recorded: boolean[] = [];
	const page = {
		evaluate: async (script: string) => {
			if (script.includes('scrollTo(0, 0)')) return 'ok';
			if (script.includes('scrollIntoView')) return 'ok';
			return JSON.stringify(result);
		}
	};
	const run = { page, record: { check: (value: boolean) => recorded.push(value) } };
	return { run: run as unknown as Parameters<typeof topLayout>[0], recorded, expected: checks };
}

const top: Measured = {
	inset: 47, scrolled: 0, strip: { fixed: true, top: 0, height: 47, opaque: true, above: 1 },
	beneath: 0, facts: 4, stacked: true, aligned: true, fits: true
};
const scrolled: Measured = { ...top, scrolled: 620, beneath: 2 };

test('measures the connected page at the top safe area', async () => {
	const example = acceptance(top, [true]);
	await topLayout(example.run);
	expect(example.recorded).toEqual([true]);
	recordExampleCases(
		{ unitId: 'desktop.script.ios-acceptance-layout', symbol: 'topLayout', state: 'measures-the-connected-page-at-the-top-safe-area', evidence: 'examples-cases', file: 'measures-the-connected-page-at-the-top-safe-area.json' },
		[{ name: 'connected page at top', input: { inset: 47, scroll: 0 }, output: { checks: example.recorded } }]
	);
});

test('checks the scrolled status bar layout', async () => {
	const example = acceptance(scrolled, [true, true, true, true]);
	await scrolledLayout(example.run);
	expect(example.recorded).toEqual([true, true, true, true]);
	recordExampleCases(
		{ unitId: 'desktop.script.ios-acceptance-layout', symbol: 'scrolledLayout', state: 'checks-the-scrolled-status-bar-layout', evidence: 'examples-cases', file: 'checks-the-scrolled-status-bar-layout.json' },
		[{ name: 'scrolled narrow status bar', input: { inset: 47, scroll: 620, beneath: 2, facts: 4 }, output: { checks: example.recorded } }]
	);
});
