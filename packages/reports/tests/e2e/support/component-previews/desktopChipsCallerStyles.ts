import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** The Game route styles its chips with these rules; the preview paints them with the same rules. */
export async function loadChipCallerStyles(page: Page) {
	const content = ['workspace-0.css', 'workspace-1.css']
		.map((file) =>
			readFileSync(
				new URL(`../../../../../desktop/src/lib/styles/${file}`, import.meta.url),
				'utf8'
			).replace(/@import[^;]+;/g, '')
		)
		.join('\n');
	await page.addStyleTag({ content });
}
