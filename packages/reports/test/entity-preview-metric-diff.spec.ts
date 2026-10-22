import { expect, test } from '../../../test/support/browserTest';
import { captureRegion, fits, open, viewports } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const page = { category: 'pages' as const, entity: ids.page, commit: commits.middle };
const expected: Array<[string, string[]]> = [
	['Source size', ['12.3 KB', '12.3 KB', 'No change']],
	['Complexity', ['21', '21', 'No change']],
	['Latency', ['14.2 ms', '12.1 ms', '−2.1 ms']],
	['Memory', ['3 MB', '2.5 MB', '−500 KB']]
];

test('a selected page diff shows before, after and performance metric changes', async ({
	page: tab
}) => {
	for (const [name, size] of Object.entries(viewports)) {
		await tab.setViewportSize(size);
		await open(tab, page, 'measurements');
		if (name === 'desktop') {
			await captureRegion(
				tab,
				'[aria-label="Performance profile"]',
				`performance-metric-diff-${process.env.SCREENSHOT_LABEL ?? 'run'}`,
				['reports.component.harness-entity-overview']
			);
		}
		const profile = tab.getByRole('region', { name: 'Performance profile', exact: true });
		const comparison = profile.getByRole('table', { name: 'Performance metric changes' });
		await expect(comparison).toBeVisible();
		await expect(profile).toContainText('Compared with first parent aaaaaaa');
		await expect(comparison.getByRole('columnheader')).toHaveText([
			'Metric',
			'Before · aaaaaaa',
			'After · bbbbbbb',
			'Change'
		]);
		for (const [label, values] of expected) {
			const row = comparison.locator('tbody tr').filter({ hasText: label });
			for (const value of values) await expect(row).toContainText(value);
		}
		expect(await fits(tab), `${name} page remains within its viewport`).toBe(true);
	}
});
