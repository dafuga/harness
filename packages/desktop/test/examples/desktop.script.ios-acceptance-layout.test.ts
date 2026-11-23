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
	inset: 47,
	scrolled: 0,
	strip: { fixed: true, top: 0, height: 47, opaque: true, above: 1 },
	beneath: 0,
	facts: 4,
	stacked: true,
	aligned: true,
	fits: true
};
const scrolled: Measured = { ...top, scrolled: 620, beneath: 2 };

test('measures the connected page at the top safe area', async () => {
	const example = acceptance(top, [true]);
	await topLayout(example.run);
	expect(example.recorded).toEqual([true]);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-layout',
			symbol: 'topLayout',
			state: 'measures-the-connected-page-at-the-top-safe-area',
			evidence: 'examples-cases',
			file: 'measures-the-connected-page-at-the-top-safe-area.json'
		},
		[
			{
				name: 'connected page at top',
				input: { inset: 47, scroll: 0 },
				output: { checks: example.recorded }
			}
		]
	);
});

test('checks the scrolled status bar layout', async () => {
	const example = acceptance(scrolled, [true, true, true, true]);
	await scrolledLayout(example.run);
	expect(example.recorded).toEqual([true, true, true, true]);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-layout',
			symbol: 'scrolledLayout',
			state: 'checks-the-scrolled-status-bar-layout',
			evidence: 'examples-cases',
			file: 'checks-the-scrolled-status-bar-layout.json'
		},
		[
			{
				name: 'scrolled narrow status bar',
				input: { inset: 47, scroll: 620, beneath: 2, facts: 4 },
				output: { checks: example.recorded }
			}
		]
	);
});

test('throws TypeError when the run is missing', async () => {
	await expect(topLayout(null as unknown as Parameters<typeof topLayout>[0])).rejects.toThrow(
		TypeError
	);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-layout',
			symbol: 'topLayout',
			state: 'throws-typeerror-when-the-run-is-missing',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-run-is-missing.json'
		},
		[{ name: 'missing acceptance run', input: { run: null }, error: { name: 'TypeError' } }]
	);
});

test('throws SyntaxError when page measurement is not JSON', async () => {
	const run = {
		page: {
			evaluate: async (script: string) => (script.includes('scrollTo(0, 0)') ? 'ok' : 'not json')
		},
		record: { check: () => undefined }
	} as unknown as Parameters<typeof topLayout>[0];
	await expect(topLayout(run)).rejects.toThrow(SyntaxError);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-layout',
			symbol: 'topLayout',
			state: 'throws-syntaxerror-when-page-measurement-is-not-json',
			evidence: 'examples-cases',
			file: 'throws-syntaxerror-when-page-measurement-is-not-json.json'
		},
		[
			{
				name: 'invalid measured JSON',
				input: { evaluation: 'not json' },
				error: { name: 'SyntaxError' }
			}
		]
	);
});

test('throws Error when page evaluation rejects', async () => {
	const failure = new Error('page evaluation failed');
	const run = {
		page: {
			evaluate: async () => {
				throw failure;
			}
		},
		record: { check: () => undefined }
	} as unknown as Parameters<typeof topLayout>[0];
	await expect(topLayout(run)).rejects.toThrow(failure);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-layout',
			symbol: 'topLayout',
			state: 'throws-error-when-page-evaluation-rejects',
			evidence: 'examples-cases',
			file: 'throws-error-when-page-evaluation-rejects.json'
		},
		[
			{
				name: 'evaluation rejection',
				input: { evaluation: 'rejects' },
				error: { name: 'Error', message: failure.message }
			}
		]
	);
});
