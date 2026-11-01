import { expect, type Locator } from '@playwright/test';

/** Captions and blocked-send reasons must be painted outside the message field. */
export async function assertComposerLayout(component: Locator, variant: string) {
	if (variant === 'visual-plan') {
		const caption = component.getByText('Visual plan · 3 design options', { exact: true });
		const field = (await component.getByRole('textbox', { name: 'Message' }).boundingBox())!;
		const bounds = (await caption.boundingBox())!;
		expect(
			bounds.y - field.y - field.height,
			'The visual-plan caption has its own line below the textarea'
		).toBeGreaterThanOrEqual(4);
		await expect(caption).toBeInViewport({ ratio: 1 });
	}
	if (variant === 'unapproved') {
		await expect(
			component.getByRole('textbox', { name: 'Message' }),
			'The approval block is exercised with a nonempty request'
		).not.toHaveValue('');
		await expect(
			component.getByRole('note').filter({ hasText: /approve the current exact design/i }),
			'Unapproved changes explain why sending is blocked'
		).toBeInViewport({ ratio: 1 });
	}
}
