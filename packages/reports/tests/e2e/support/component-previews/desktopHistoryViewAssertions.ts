import { expect, type Locator } from '@playwright/test';

/** Populated history and multiple-view states must be visible in the captured pixels. */
export async function assertHistoryViewCapture(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.shared-primitives-loading-state' && variant === 'inline')
		await expect(
			component.locator('.hx-loading'),
			'Inline loading stays in document flow'
		).toHaveCSS('position', 'static');
	if (id === 'desktop.component.game-view-fields' && variant === 'multiple') {
		const views = component.getByRole('listbox', { name: 'View', exact: true });
		await expect(views, 'Multiple views are listed visibly in the capture').toBeVisible();
		await expect(views.locator('option')).toHaveText(['The courtyard', 'Garden return route']);
		for (const option of await views.locator('option').all())
			await expect(option).toBeInViewport({ ratio: 1 });
	}
	if (id !== 'desktop.component.history-panel') return;
	const proof = component.getByRole('region', { name: 'Regression proof', exact: true });
	if (variant === 'empty') {
		await expect(proof).toContainText('No regression proof is available for this unit.');
		return;
	}
	await expect(proof, 'Populated history includes recorded regression proof').toContainText(
		'Regression fixed'
	);
	await expect(proof).toContainText('order search case insensitivity');
	await expect(proof.getByRole('link', { name: 'View failing test commit' })).toBeVisible();
	await expect(proof.getByRole('link', { name: 'View fix commit', exact: true })).toBeVisible();
	if (variant === 'loading')
		await expect(
			component.getByRole('status').filter({ hasText: 'Loading earlier history…' }),
			'Pending history has a visible loading indicator and label'
		).toBeVisible();
}

/** A ready record carries its proof; pending or unavailable reads cannot claim proof is absent. */
export async function assertRuntimeEvidenceProof(component: Locator, id: string, variant: string) {
	if (id !== 'desktop.component.runtime-evidence') return;
	const proof = component.getByRole('region', { name: 'Regression proof', exact: true });
	if (!['', 'offline'].includes(variant)) {
		await expect(proof, 'Only loaded records show a regression proof verdict').toHaveCount(0);
		return;
	}
	await expect(proof, 'Recorded runtime evidence includes regression proof').toContainText(
		'Regression fixed'
	);
	await expect(proof).toContainText('order card delivery status');
	await expect(proof.getByRole('link', { name: 'View failing test commit' })).toBeVisible();
	await expect(proof.getByRole('link', { name: 'View fix commit', exact: true })).toBeVisible();
}
