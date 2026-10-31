import { expect, type Locator } from '@playwright/test';

/** Validate the real caller's navigation and trigger-relative picker after its capture. */
export async function assertChatPreviewState(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.console-chat' && /^(model|effort)-(open|selected)$/.test(variant))
		await pickerAnchor(
			component,
			variant.startsWith('model') ? 'Choose model' : 'Reasoning effort'
		);
	if (id !== 'reports.component.floating-chat' || variant !== 'navigation') return;
	const nav = component.getByRole('navigation', { name: 'Project chat' });
	const link = nav.getByRole('link', { name: 'Project activity' });
	await expect(nav).toHaveCSS('padding-left', '14px');
	await expect(link).toHaveCSS('text-decoration-line', 'underline');
	await expect(link).toHaveAttribute('href', '/harness');
	const box = (await link.boundingBox())!;
	const panel = (await component.locator('.floating-chat-panel').boundingBox())!;
	expect(box.x - panel.x, 'Chat navigation aligns inside the panel gutter').toBeGreaterThanOrEqual(
		14
	);
	await link.focus();
	await expect(link).toBeFocused();
}

async function pickerAnchor(component: Locator, name: string) {
	const dialog = component.getByRole('dialog', { name, exact: true });
	const trigger = component.getByRole('button', { name, exact: true, includeHidden: true });
	const box = (await dialog.boundingBox())!;
	const icon = (await trigger.boundingBox())!;
	const header = (await component.locator('.floating-chat-panel > header').boundingBox())!;
	const gap = Math.min(
		Math.abs(box.y + box.height - icon.y),
		Math.abs(box.y - icon.y - icon.height)
	);
	expect(gap, 'Chat picker stays beside its opening button').toBeLessThanOrEqual(2);
	expect(Math.min(box.x + box.width - icon.x, icon.x + icon.width - box.x)).toBeGreaterThan(0);
	expect(box.y, 'Chat picker leaves the panel title visible').toBeGreaterThanOrEqual(
		header.y + header.height
	);
	const viewport = component.page().viewportSize()!;
	expect(box.x).toBeGreaterThanOrEqual(12);
	expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 12);
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 12);
	await component.page().keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
	await expect(component.locator('.floating-chat-panel')).toBeVisible();
	await trigger.press('Enter');
	await expect(dialog).toBeVisible();
}
