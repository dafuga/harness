import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { usagePreviewStyle } from '../../src/components/explorer-ui/usagePreviewStyle';

function preview(rect: { top: number; bottom: number }, viewport: { width: number; height: number }) {
	const link = {
		getBoundingClientRect: () => ({
			left: 20, right: 60, top: rect.top, bottom: rect.bottom,
			width: 40, height: rect.bottom - rect.top
		})
	} as unknown as HTMLElement;
	const root = {
		querySelector: () => link,
		closest: () => null
	} as unknown as HTMLElement;
	const tip = {
		style: { width: '' }, scrollHeight: 96, offsetHeight: 96, clientHeight: 0
	} as unknown as HTMLElement;
	return usagePreviewStyle(root, tip, viewport);
}

test('Places visible usage previews within the viewport', () => {
	const cases = [
		{ name: 'wide desktop room', input: { link: { top: 30, bottom: 50 }, view: { width: 1440, height: 900 } }, output: 'left:8px;top:58px;width:280px' },
		{ name: 'narrow viewport room', input: { link: { top: 30, bottom: 50 }, view: { width: 136, height: 667 } }, output: 'left:8px;top:58px;width:120px' }
	];
	const actual = cases.map(({ input }) => preview(input.link, input.view));
	expect(actual).toEqual(cases.map(({ output }) => output));
	recordExampleCases(
		{ unitId: 'reports.function.explorer-ui-usage-preview-style', symbol: 'usagePreviewStyle', state: 'places-visible-usage-previews-within-the-viewport', evidence: 'examples-cases', file: 'places-visible-usage-previews-within-the-viewport.json' },
		cases.map((entry, index) => ({ ...entry, output: actual[index] }))
	);
});

test('Hides usage previews when their link is off screen', () => {
	const input = { link: { top: 901, bottom: 921 }, view: { width: 1440, height: 900 } };
	const output = preview(input.link, input.view);
	expect(output).toBeNull();
	recordExampleCases(
		{ unitId: 'reports.function.explorer-ui-usage-preview-style', symbol: 'usagePreviewStyle', state: 'hides-usage-previews-when-their-link-is-off-screen', evidence: 'examples-cases', file: 'hides-usage-previews-when-their-link-is-off-screen.json' },
		[{ name: 'link begins below viewport', input, output }]
	);
});
