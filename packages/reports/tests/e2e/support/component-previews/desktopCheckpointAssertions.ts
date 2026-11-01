import { expect, type Locator, type Page } from '@playwright/test';

/** An expanded checkpoint capture must include its complete rule rows and readable field values. */
export async function assertCheckpointCapture(component: Locator, id: string, variant: string) {
	if (id !== 'desktop.component.game-checkpoint-pane') return;
	if (variant === 'advanced') {
		for (const name of ['Condition 1', 'Action 1', 'Action 2'])
			await expect(
				component.getByRole('group', { name, exact: true }),
				'Advanced checkpoint rule rows must be fully visible in the capture'
			).toBeInViewport({ ratio: 1 });
		await expect(
			component.getByRole('textbox', { name: 'Prerequisites', exact: true })
		).toHaveValue('key');
		await expect(component.getByRole('textbox', { name: 'Condition 1 field' })).toHaveValue(
			'keys collected'
		);
	}
	if (variant !== 'long') return;
	const title = component.getByRole('textbox', { name: 'Checkpoint title', exact: true });
	const description = component.getByRole('textbox', {
		name: 'Describe your checkpoint',
		exact: true
	});
	expect(
		(await title.inputValue()).length,
		'The long checkpoint uses a genuinely long title'
	).toBeGreaterThanOrEqual(90);
	const sentences = (await description.inputValue())
		.split(/[.!?]+/)
		.map((text) => text.trim())
		.filter(Boolean);
	expect(
		new Set(sentences).size,
		'The checkpoint description contains distinct story sentences'
	).toBeGreaterThanOrEqual(3);
	await expect(description).not.toHaveValue(
		/A detailed description of the checkpoint and its outcome/
	);
	for (const field of [title, description]) {
		const fit = await field.evaluate((node: HTMLInputElement | HTMLTextAreaElement) => ({
			width: node.scrollWidth - node.clientWidth,
			height: node.scrollHeight - node.clientHeight
		}));
		expect(fit.width, 'Checkpoint text must wrap without horizontal clipping').toBeLessThanOrEqual(
			1
		);
		expect(
			fit.height,
			'Checkpoint text must grow without hiding its last line'
		).toBeLessThanOrEqual(1);
	}
}

/** Keep the standard viewport width and enlarge its height to show the complete modal contents. */
export async function frameCheckpointCapture(page: Page, id: string) {
	if (id !== 'desktop.component.game-checkpoint-pane') return;
	const content = page.locator(`[data-preview-unit="${id}"] .viewer-content`);
	const hiddenHeight = await content.evaluate((node) => node.scrollHeight - node.clientHeight);
	if (hiddenHeight > 0) {
		const viewport = page.viewportSize()!;
		await page.setViewportSize({ ...viewport, height: viewport.height + hiddenHeight + 48 });
	}
	await content.evaluate((node) => node.scrollTo(0, 0));
}
