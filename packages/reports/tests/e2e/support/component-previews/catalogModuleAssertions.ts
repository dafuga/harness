import { expect, type Locator } from '@playwright/test';

export async function assertModulePreview(component: Locator, id: string, variant = '') {
	if (id === 'reports.component.networking-security-explorer-permissions-screen' && !variant) {
		for (const text of [
			'Member',
			'app.endpoint.orders',
			'GET',
			'app.model.order',
			'Own account only'
		])
			await expect(component.getByText(text, { exact: false }).first()).toBeVisible();
	}
	await assertModules(component, id, variant);
	await assertResources(component, id, variant);
}

async function assertModules(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.module-system-explorer-modules-screen') {
		if (variant) {
			if (!['playwright', 'headless-audio'].includes(variant)) return;
			await expect(
				component.getByRole('heading', {
					level: 1,
					name: variant === 'playwright' ? 'Playwright' : 'Headless audio',
					exact: true
				})
			).toBeVisible();
			await expect(component).toContainText(`harness plugin test ${variant}`);
			await expect(component.getByText('Testing', { exact: true })).toBeVisible();
			return;
		}
		await expect(
			component.getByRole('link', { name: 'Rust WebAssembly', exact: true })
		).toBeVisible();
		await expect(component.getByRole('link', { name: 'Rust Backend', exact: true })).toBeVisible();
		await expect(
			component.getByRole('heading', { level: 1, name: 'Plugins', exact: true })
		).toBeVisible();
		await expect(component.getByRole('link', { name: 'Email', exact: true })).toBeVisible();
		await expect(component.getByText('Installed', { exact: true })).toBeVisible();
		await expect(component.getByRole('link', { name: 'Layouts', exact: true })).toHaveCount(0);
		await expect(component.getByRole('link', { name: 'Playwright', exact: true })).toBeVisible();
		await expect(
			component.getByRole('link', { name: 'Headless audio', exact: true })
		).toBeVisible();
		await expect(component).toContainText('harness plugin add offline');
	}
}

async function assertResources(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.module-system-explorer-module-resources-screen') {
		if (variant) {
			if (variant !== 'playwright') return;
			await expect(
				component.getByRole('heading', { level: 1, name: 'Browser tests', exact: true })
			).toBeVisible();
			await expect(component).toContainText('harness plugin generate playwright test');
			await expect(component).toContainText('Nothing generated yet.');
			return;
		}
		await expect(component.getByRole('heading', { name: 'Emails', exact: true })).toBeVisible();
		await expect(component.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
		await expect(component).toContainText('harness plugin generate email email');
	}
}
