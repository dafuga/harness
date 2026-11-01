import { expect, type Locator } from '@playwright/test';

const checks: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'reports.component.explorer-catalog-items': paginationHover,
	'reports.component.evidence-provenance': provenanceHash,
	'reports.component.contract-table': shortExamples,
	'reports.component.entity-contract': shortExamples,
	'reports.component.harness-harness-selectors': selectedLabels,
	'reports.component.harness-harness-verdict': tooltipFit,
	'reports.component.harness-entity-artifact': artifactExtent,
	'reports.component.harness-entity-behavior': behaviorSummary
};

/** Check the recorded state after capture so rejected pixels remain available for diagnosis. */
export async function assertVisualReviewFit(component: Locator, id: string, variant: string) {
	await checks[id]?.(component, variant);
}

async function paginationHover(component: Locator, variant: string) {
	if (variant !== 'batch-hovered') return;
	await expect(
		component.getByRole('button', { name: 'View more Components' }),
		'Pagination hover visibly underlines its action'
	).toHaveCSS('text-decoration-line', 'underline');
}

async function provenanceHash(component: Locator, variant: string) {
	if (variant !== 'long') return;
	const value = component.locator('dd').last();
	const geometry = await value.evaluate((node) => {
		const text = document.createRange();
		text.selectNodeContents(node);
		const box = text.getBoundingClientRect();
		return {
			height: box.height,
			line: parseFloat(getComputedStyle(node).lineHeight),
			clipped: box.width > node.clientWidth + 1
		};
	});
	expect(geometry.height, 'Revision hash stays on one deliberate line').toBeLessThanOrEqual(
		geometry.line + 1
	);
	if (geometry.clipped)
		await expect(value.getByTitle((await value.innerText()).trim())).toBeVisible();
}

async function shortExamples(component: Locator) {
	const clipped = await component
		.locator('.example code')
		.evaluateAll((codes) =>
			codes
				.filter(
					(code) => (code.textContent ?? '').length <= 14 && code.scrollWidth > code.clientWidth + 1
				)
				.map((code) => code.textContent)
		);
	expect(clipped, 'Short contract examples fit without an ellipsis').toEqual([]);
}

async function selectedLabels(component: Locator) {
	const clipped = await component.locator('select').evaluateAll((fields: HTMLSelectElement[]) => {
		const canvas = document.createElement('canvas').getContext('2d')!;
		return fields.flatMap((field) => {
			const display = field.parentElement?.querySelector<HTMLElement>('.report-select-value');
			const text = display?.textContent ?? field.selectedOptions[0]?.textContent ?? '';
			const style = getComputedStyle(display ?? field);
			canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			const available = display
				? display.clientWidth
				: field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			return !text.trim() || canvas.measureText(text.trim()).width > available + 1
				? [field.getAttribute('aria-label')]
				: [];
		});
	});
	expect(clipped, 'Every closed selector has a complete readable summary').toEqual([]);
}

async function tooltipFit(component: Locator, variant: string) {
	if (!variant.endsWith('-open')) return;
	const tooltip = component.getByRole('tooltip');
	const geometry = await tooltip.evaluate((node: HTMLElement) => {
		const box = node.getBoundingClientRect();
		const mark = node.closest('.hx-verdict')!.querySelector('button')!.getBoundingClientRect();
		const style = getComputedStyle(node);
		return {
			left: box.left,
			right: box.right,
			markLeft: mark.left,
			markRight: mark.right,
			gutter:
				node.offsetWidth -
				node.clientWidth -
				parseFloat(style.borderLeftWidth) -
				parseFloat(style.borderRightWidth)
		};
	});
	expect(geometry.left, 'Tooltip remains horizontally anchored to its mark').toBeLessThanOrEqual(
		geometry.markRight + 1
	);
	expect(geometry.right).toBeGreaterThanOrEqual(geometry.markLeft - 1);
	if (variant !== 'long-open')
		expect(geometry.gutter, 'A short tooltip has no false scrollbar').toBe(0);
}

async function artifactExtent(component: Locator, variant: string) {
	if (!['expanded', 'raw-open', 'plain-text', 'long'].includes(variant)) return;
	const clipped = await component
		.locator('.ex-artifact')
		.evaluate((node) => node.scrollHeight - node.clientHeight);
	expect(clipped, 'The complete opened artifact follows the page scroll').toBeLessThanOrEqual(1);
	const textClipping = await component
		.locator('.ex-artifact > details pre:visible')
		.evaluateAll((nodes) => nodes.map((node) => node.scrollHeight - node.clientHeight));
	expect(
		Math.max(0, ...textClipping),
		'The complete recorded text follows the page scroll'
	).toBeLessThanOrEqual(1);
}

async function behaviorSummary(component: Locator, variant: string) {
	const summary = component.locator('.ex-change');
	const wrapped = await summary.locator('.ex-inline dd').evaluateAll((nodes) =>
		nodes
			.filter((node) => {
				if (!/^(passed|failed)$/.test(node.textContent?.trim() ?? '')) return false;
				const text = document.createRange();
				text.selectNodeContents(node);
				return (
					text.getBoundingClientRect().height > parseFloat(getComputedStyle(node).lineHeight) + 1
				);
			})
			.map((node) => node.textContent)
	);
	expect(wrapped, 'Single-word behavior statuses stay on one line').toEqual([]);
	if (variant === 'loading')
		await expect(summary, 'Pending results do not claim an absent reason').not.toContainText(
			'No reason is recorded'
		);
	if (variant === 'changed') {
		await expect(summary, 'Change reasons have clean punctuation').not.toContainText('.;');
		expect(
			await summary.locator('.ex-change-reasons p').count(),
			'Each reason is a separate paragraph'
		).toBeGreaterThan(1);
	}
}
