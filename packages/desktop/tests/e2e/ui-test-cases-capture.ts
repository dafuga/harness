import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { buildStamp } from '../../../../src/utils/buildStamp';
import { evidenceRequested, recordCapture } from '../../../../src/utils/recordCapture';
import scenario from '../../../../specification/scenarios/shared-test-cases.json' with { type: 'json' };

const note =
	'Actual compiled workspace over SYNTHETIC orders and history. Input is browser navigation; output is read from the rendered DOM, never copied from an assertion expectation.';
const viewportOf = (page: Page) => {
	const size = page.viewportSize();
	const found = scenario.viewports.find(
		(item) => item.width === size?.width && item.height === size?.height
	);
	if (!found) throw new Error('The viewport is not declared by shared-test-cases');
	return found.id;
};

async function observed(page: Page) {
	const region = page.getByRole('region', { name: 'Evidence coverage' });
	return {
		heading: await page.getByRole('heading', { level: 1 }).innerText(),
		contracts: await page
			.getByRole('heading', { name: 'Contract', exact: true })
			.locator('..')
			.allTextContents(),
		tables: await region
			.getByRole('table')
			.filter({ hasText: 'Observed output' })
			.evaluateAll((tables) =>
				tables.map((table) =>
					[...table.querySelectorAll('tr')].map((row) =>
						[...row.querySelectorAll('th, td')].map((cell) => (cell as HTMLElement).innerText)
					)
				)
			),
		modes: await page
			.getByRole('group', { name: 'Request mode' })
			.getByRole('button')
			.allTextContents()
	};
}

async function served(page: Page) {
	const buildId = buildStamp(
		(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
	);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
	if (!buildId || process.env.HARNESS_VERIFY !== '1' || !/^[a-f0-9]{40}$/.test(revision))
		throw new Error('A compiled build stamp and verified revision are required');
	return { buildId, revision };
}

async function record(page: Page, data: { state: string; input: unknown; output: unknown }) {
	const viewport = viewportOf(page);
	const server = await served(page);
	const evidence = scenario.evidence.find(
		(item) => item.id === `test-cases-${viewport}` && item.states.includes(data.state)
	);
	if (!evidence) throw new Error('The capture state is not declared for this viewport');
	recordCapture(
		{
			evidence: evidence.id,
			kind: 'screenshot',
			state: data.state,
			viewport,
			file: `test-cases-${data.state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server,
			note
		},
		await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
	);
	if (viewport === 'desktop') recordObservation({ ...data, server });
}

function recordObservation(data: {
	state: string;
	input: unknown;
	output: unknown;
	server: { buildId: string; revision: string };
}) {
	recordCapture(
		{
			evidence: 'test-cases-observations',
			kind: 'trace',
			state: data.state,
			file: `test-cases-${data.state}.json`,
			mediaType: 'application/json',
			provenance: 'actual-capture',
			server: data.server,
			note
		},
		JSON.stringify({
			scenario: 'Shared test case views',
			fixture: note,
			input: data.input,
			output: data.output
		})
	);
}

/** Observe the actual shell after navigation; keep the same phase checkpoint before assertions. */
export async function remember(page: Page, info: TestInfo, state: string, input: unknown) {
	await expect(page.getByText(/Reading what it holds|Reading the recorded results/)).toHaveCount(0);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			[...document.images].map(async (image) => {
				await image.decode();
				if (!image.complete || image.naturalWidth <= 0) throw new Error('Image is not ready');
			})
		);
	});
	await page.mouse.move(0, 0);
	const output = await observed(page);
	const viewport = viewportOf(page);
	if (process.env.TAKE_SCREENSHOT === 'true') {
		const folder = process.env.TEST_CASE_SHOTS ?? info.outputDir;
		mkdirSync(folder, { recursive: true });
		await page.screenshot({
			path: join(folder, `${process.env.SCREENSHOT_LABEL ?? 'run'}-${state}-${viewport}.png`),
			fullPage: true
		});
	}
	if (evidenceRequested()) await record(page, { state, input, output });
	return output;
}
