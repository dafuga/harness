import { expect, type Locator } from '@playwright/test';

export async function assertKitPill(component: Locator, variant: string) {
	const treatments = {
		'list-item': ['li.ex-pill', 'Read invoices'],
		compact: ['.pill', 'Approved'],
		chip: ['.chip', 'Current revision'],
		attributes: ['.ex-pill', 'Approved invoice']
	};
	if (variant in treatments) {
		const [selector, label] = treatments[variant as keyof typeof treatments];
		const root = component.locator(selector);
		await expect(root).toBeVisible();
		await expect(root).toHaveText(label);
		if (variant === 'chip') {
			await expect(root).toHaveCSS('border-top-style', 'solid');
			expect(
				await root.evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingLeft))
			).toBeGreaterThan(0);
		}
		if (variant === 'attributes') {
			await expect(root).toHaveAttribute('role', 'img');
			await expect(root).toHaveAttribute('aria-label', 'Invoice approved');
			await expect(root).toHaveAttribute('title', 'Invoice A-1048');
			await expect(root).toHaveAttribute('data-state', 'approved');
		}
		return;
	}
	const root = component.locator('.ex-pill');
	await expect(root).toHaveText(variant === 'state' ? 'Available' : 'Installed');
	if (variant)
		await expect(root).toHaveAttribute(
			'data-state',
			variant === 'state' ? 'Available' : 'Installed'
		);
	else await expect(root).not.toHaveAttribute('data-state');
	if (variant === 'tone') {
		await expect(root).toHaveClass(/mod-state/);
		const colors = await root.evaluate((node) => {
			const style = getComputedStyle(node);
			const context = document.createElement('canvas').getContext('2d')!;
			context.fillStyle = style.color;
			const actual = context.fillStyle;
			context.fillStyle = style.getPropertyValue('--ex-soft');
			return { actual, plain: context.fillStyle };
		});
		expect(colors.actual, 'Pill tone changes the painted label color').not.toBe(colors.plain);
	}
}

export async function assertKitEmpty(component: Locator, variant: string) {
	const root = component.locator(variant === 'block' ? 'div.ex-empty' : 'p.ex-empty');
	const messages = {
		block: 'No invoices have been approved in this project.',
		status: 'No approved invoices match this search.'
	};
	const message = messages[variant as keyof typeof messages] ?? 'No dependencies recorded';
	await expect(root).toContainText(message);
	if (variant === 'status') await expect(root).toHaveAttribute('role', 'status');
	const action = component.getByRole('link', { name: 'Browse components' });
	await expect(action).toHaveCount(variant === 'action' ? 1 : 0);
	if (variant === 'action') {
		await expect(action).toHaveAttribute('href', '/harness/components');
		await action.focus();
		await expect(action).toBeFocused();
	}
}

export async function assertKitNotice(component: Locator, variant: string) {
	const roles = { list: 'list', alert: 'alert' } as const;
	const role = roles[variant as keyof typeof roles] ?? 'note';
	const root = component.getByRole(role);
	const messages = {
		alert: 'The selected revision has no retained mobile capture.',
		block: 'Only the latest build has retained screenshots.',
		list: 'No selected mobile capture is retained. The parent screenshot is available in history.'
	};
	await expect(root).toContainText(
		messages[variant as keyof typeof messages] ?? 'Some dependencies could not be read'
	);
	if (variant === 'list') {
		await expect(component.locator('ul.ex-notice')).toHaveCount(1);
		await expect(root.getByRole('listitem')).toHaveText([messages.list]);
	}
	if (variant === 'block') await expect(component.locator('div.ex-notice')).toHaveCount(1);
	if (variant === 'long') await expect(root).toContainText('AgentControls.svelte');
	await expect(root).not.toContainText('source/source/');
	expect(await root.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
}
