import { createRawSnippet } from 'svelte';
import type { ComparisonPane } from '../../../../src/helpers/verification-evidence/comparisonPanes.types';
import { comparisonPanes } from '../../../../src/helpers/verification-evidence/comparisonPanes';
import { commits } from '../../../../test/entityUnits';
import { expect, type Locator } from '@playwright/test';

import type { Content } from './comparePanesPreview.types';
const children = createRawSnippet<[ComparisonPane<Content>]>((pane) => ({
	render: () => `<p>${pane().value?.summary ?? ''}</p>`
}));
const details = createRawSnippet<[ComparisonPane<Content>]>((pane) => ({
	render: () => `<p>Build: ${pane().value?.build ?? 'Not recorded'}</p>`
}));

/** One pair carries its own source data; missing sides stay visible gaps. */
export function comparePanesPreview(variant = '') {
	const before = {
		commit: commits.middle,
		value: { summary: 'Invoice awaiting approval', build: 'orders-parent' }
	};
	const after = {
		commit: commits.tip,
		value: { summary: 'Invoice approved by Daniel', build: 'orders-selected' }
	};
	if (variant === 'missing-parent')
		return {
			children,
			panes: comparisonPanes(
				{ commit: commits.middle, gap: 'No parent capture is recorded.' },
				after
			)
		};
	if (variant === 'missing-selected')
		return {
			children,
			panes: comparisonPanes(before, {
				commit: commits.tip,
				gap: 'No selected capture is recorded.'
			})
		};
	return {
		children,
		panes: comparisonPanes(before, after, variant !== 'single'),
		...(variant === 'details' ? { details } : {})
	};
}

export async function assertComparePanesPreview(component: Locator, variant: string) {
	const before = component.getByRole('group', { name: /^Before ·/ });
	const after = component.getByRole('group', { name: /^(?:After|Current snapshot) ·/ });
	await expect(before).toHaveCount(variant === 'single' ? 0 : 1);
	await expect(after).toHaveCount(1);
	await expect(after).toContainText(
		variant === 'missing-selected'
			? 'No selected capture is recorded.'
			: 'Invoice approved by Daniel'
	);
	if (variant === 'missing-parent')
		await expect(before).toContainText('No parent capture is recorded.');
	else if (variant !== 'single') await expect(before).toContainText('Invoice awaiting approval');
	if (variant === 'details') {
		await expect(before).toContainText('Build: orders-parent');
		await expect(after).toContainText('Build: orders-selected');
		await expect(after).not.toContainText('orders-parent');
		await expect(before).not.toContainText('orders-selected');
	}
}
