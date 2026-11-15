import { createHash } from 'node:crypto';
import { chromium, type Page } from '@playwright/test';
import type { HarnessRevision } from '../../../../src/models/explorer-ui/Harness.types';
import type { RegressionView } from '../../../../../../src/core/regressionTypes';
import type { Data } from './illustratedData.types';
import { record, revision } from '../../../../test/entityFixture';
import { capture, commits, ids } from '../../../../test/entityUnits';
import { place, scope } from '../../../../test/entityPlaces';
import { explorerEvidence } from '../../../../src/utils/explorer-ui/explorerEvidence';
import { shellImage } from './shellArtworkImages';

const viewports = [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 768, height: 1024 },
	{ id: 'mobile', width: 390, height: 844 }
];

/** Record this section's representative Orders inputs; never substitute another state's bytes. */
export async function entitySectionsEvidenceFixtures(data: Data) {
	const head = revision(commits.middle, [record(commits.middle)]);
	const parent = revision(commits.first, [record(commits.first)]);
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		for (const detail of [parent, head]) await recordSectionScreens(page, data, detail);
		if (errors.length) throw new Error(`Orders fixture browser errors: ${errors.join('; ')}`);
	} finally {
		await browser.close();
	}
	head.regressions = [emptySearchProof()];
	const unit = head.registry.units.find((item) => item.id === ids.list)!;
	return explorerEvidence(
		scope('commit', place({ category: 'components', entity: ids.list })),
		{ head, parent },
		unit
	);
}

async function recordSectionScreens(page: Page, data: Data, detail: HarnessRevision) {
	const result = detail.records[0].scenarios.find((item) => item.id === 'orders-page')!;
	for (const state of result.states) {
		state.captures = [];
		for (const viewport of viewports) {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.setContent(sectionArtwork(viewport.id, state.id, detail.commit === commits.first));
			await page.evaluate(() => document.fonts.ready);
			const bytes = await page.screenshot({ animations: 'disabled' });
			const sha256 = createHash('sha256').update(bytes).digest('hex');
			data.bytes[sha256] = { mediaType: 'image/png', data: [...bytes] };
			state.captures.push({
				...capture(detail.commit, { kind: 'screenshot', state: state.id, viewport: viewport.id }),
				sha256,
				path: `records/orders-list/${detail.commit}/${state.id}-${viewport.id}.png`,
				media: `media/${sha256}.png`,
				server: { buildId: `orders-list-${detail.commit.slice(0, 7)}`, revision: detail.commit }
			});
		}
	}
	detail.registry.scenarios = detail.registry.scenarios.map((scenario) =>
		scenario.id !== 'orders-page'
			? scenario
			: {
					...scenario,
					title: 'Browse customer orders and delivery status',
					viewports,
					evidence: (scenario.evidence ?? []).map((slot) => ({
						...slot,
						viewports: viewports.map((viewport) => viewport.id)
					}))
				}
	);
}

/** Both revisions retain distinct state artwork at the declared viewport's native dimensions. */
function sectionArtwork(viewport: string, state: string, before: boolean) {
	let svg = decodeURIComponent(shellImage(ids.list, viewport, before).split(',')[1]);
	if (state === 'empty')
		svg = svg
			.replace(
				`Order A-1048 · ${before ? 'Processing' : 'Ready to ship'}`,
				before ? 'No orders yet' : 'No matching orders'
			)
			.replace('Order A-1047 · Delivered', 'Try another customer or reference');
	return `<style>body{margin:0}svg{display:block}</style>${svg}`;
}

/** An authored synthetic regression example belongs to this OrderList, not another fixture unit. */
function emptySearchProof(): RegressionView {
	const command = 'bunx playwright test tests/orders-list.spec.ts --grep "empty search"';
	const assertion = 'An unmatched customer search displays the empty Orders message.';
	return {
		loop: 'orders-empty-search-message',
		units: [ids.list],
		red: {
			commit: commits.first,
			status: 'failed',
			command,
			assertion,
			output: 'Expected: "No matching orders". Received: "No orders yet". 1 failed, 2 passed.',
			finishedAt: '2026-10-09T09:40:00Z'
		},
		green: {
			commit: commits.middle,
			status: 'passed',
			command,
			assertion,
			output: '3 passed: populated orders, empty search and cleared search.',
			finishedAt: '2026-10-09T10:00:00Z'
		}
	};
}
