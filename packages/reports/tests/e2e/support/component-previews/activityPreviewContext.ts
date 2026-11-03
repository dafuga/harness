import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';

const activityCards = new Set([
	'reports.component.activity-agents',
	'reports.component.activity-files',
	'reports.component.activity-loops',
	'reports.component.activity-work'
]);
let parentCss: string | undefined;

/** Render standalone cards with the same stylesheet their Project Activity parent provides. */
export async function applyActivityPreviewContext(page: Page, content: Locator, id: string) {
	const list = id === 'reports.component.activity-list';
	if (!activityCards.has(id) && !list) return;
	// The list has no Project Activity parent left to borrow styles from; only the cards do.
	if (!list && !(await page.locator('style[data-activity-preview]').count())) {
		const style = await page.addStyleTag({ content: projectActivityCss() });
		await style.evaluate((node) =>
			(node as HTMLStyleElement).setAttribute('data-activity-preview', '')
		);
	}
	await content.evaluate((node) => node.classList.add('project-activity', 'activity-preview'));
	if (list) return;
	const card = content.locator('.pa-card');
	await expect(card).toHaveCSS('border-top-style', 'solid');
	if (id === 'reports.component.activity-loops' && (await card.locator('.pa-row').count()))
		await expect(card.locator('.pa-row').first()).toHaveCSS('display', 'flex');
}

function projectActivityCss(): string {
	if (parentCss) return parentCss;
	const source = new URL(
		'../../../../src/components/projects-sessions/project-activity/ProjectActivity.svelte',
		import.meta.url
	);
	const result = compile(readFileSync(source, 'utf8'), {
		filename: source.pathname,
		cssHash: () => 'activity-preview'
	});
	if (!result.css?.code) throw new Error('Project Activity has no card stylesheet.');
	return (parentCss = result.css.code);
}
