import { expect, type Locator } from '@playwright/test';

/** Painted captions and reasons distinguish the named catalog states. */
export async function assertDesktopPresentation(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.composer') await assertComposerPresentation(component, variant);
	if (id === 'desktop.component.status-icon') await assertStatusPresentation(component, variant);
	if (id === 'desktop.component.project-agent') await assertChatPresentation(component, variant);
	if (id === 'desktop.component.runtime-behavior')
		await assertBehaviorPresentation(component, variant);
	if (id === 'desktop.component.runtime-screens')
		await assertScreenPresentation(component, variant);
	if (id === 'desktop.component.game-level-brief' && variant === 'long') {
		const fits = await component
			.getByRole('textbox', { name: 'Level brief', exact: true })
			.evaluate((node) => node.scrollHeight <= node.clientHeight + 1);
		expect(fits, 'The full level brief fits without a clipped last line').toBe(true);
	}
	if (id === 'desktop.component.design-panel' && variant === 'long')
		await expect(
			component.getByRole('combobox', { name: 'Design version', exact: true })
		).toBeVisible();
}

async function assertChatPresentation(component: Locator, variant: string) {
	if (variant === 'closed') return;
	if (['failure', 'running'].includes(variant)) {
		await expect(
			component.getByRole('textbox', { name: 'Message' }),
			'Restored drafts retain the complete review request'
		).toHaveValue(/including mixed-case names and empty queries\.\s*$/);
		const fits = await component
			.getByRole('textbox', { name: 'Message' })
			.evaluate((node) => node.scrollTop === 0 && node.scrollHeight <= node.clientHeight + 1);
		expect
			.soft(fits, 'The complete restored draft is readable without a clipped first line')
			.toBe(true);
	}
	if (variant === 'failure')
		await expect
			.soft(
				component.getByText('The agent connection closed before the review finished. Try again.', {
					exact: true
				}),
				'A failed run presents its error once'
			)
			.toHaveCount(1);
	if (variant === 'visual-plan')
		await expect(
			component.getByText('Visual plan · 7 design options', { exact: true })
		).toBeVisible();
	const first = component.locator('.chat-message').first();
	if (await first.count()) {
		const body = (await component.locator('.floating-chat-body').boundingBox())!;
		const message = (await first.boundingBox())!;
		expect(
			message.y,
			'The first conversation bubble starts inside the scroll area'
		).toBeGreaterThanOrEqual(body.y);
	}
	if (variant === 'agents-many') {
		await expect(component.getByRole('button', { name: 'Show all 8 sessions' })).toBeInViewport({
			ratio: 1
		});
		const body = (await component.locator('.floating-chat-body').boundingBox())!;
		const last = (await component
			.getByRole('list', { name: 'Agent sessions' })
			.locator('li')
			.last()
			.boundingBox())!;
		expect(
			last.y + last.height,
			'The session preview ends after a complete row'
		).toBeLessThanOrEqual(body.y + body.height);
	}
}

async function assertBehaviorPresentation(component: Locator, variant: string) {
	await expect(component).not.toContainText(/\bbehaviour\b/);
	if (variant === 'empty')
		await expect(component.locator('.runtime-facts')).not.toContainText(/\d+ ms|passed/);
	if (variant || component.page().viewportSize()!.width > 560) return;
	const head = component.locator('.runtime-pane-head').first();
	const badge = (await head.locator('.chip').boundingBox())!;
	const icon = (await head.locator('.verification-wrap').boundingBox())!;
	expect(
		Math.abs(badge.y + badge.height / 2 - icon.y - icon.height / 2),
		'The branch-tip badge and status icon remain together'
	).toBeLessThanOrEqual(2);
}

async function assertScreenPresentation(component: Locator, variant: string) {
	if (!['paired', 'incomparable'].includes(variant)) return;
	const images = component.getByRole('img');
	await expect(images).toHaveCount(2);
	const dimensions = await images.evaluateAll((nodes) =>
		nodes.map((node) => ({
			width: (node as HTMLImageElement).naturalWidth,
			height: (node as HTMLImageElement).naturalHeight
		}))
	);
	const hashes = await images.evaluateAll(async (nodes) =>
		Promise.all(
			nodes.map(async (node) => {
				const bytes = await (await fetch((node as HTMLImageElement).src)).arrayBuffer();
				const hash = await crypto.subtle.digest('SHA-256', bytes);
				return [...new Uint8Array(hash)].join(',');
			})
		)
	);
	expect(new Set(hashes).size, 'Before and after retain visibly different capture inputs').toBe(2);
	expect(dimensions.map((item) => item.width)).toEqual(
		variant === 'paired' ? [1440, 1440] : [1440, 1280]
	);
	if (variant === 'incomparable') {
		await expect(
			component.getByRole('combobox', { name: 'Scenario', exact: true }).locator('option:checked')
		).toHaveText('Order card alone');
		await expect(component.locator('.runtime-gap')).toContainText('Order card alone');
	}
	await expect(
		component.getByText('One recorded scenario', { exact: true }),
		'A fixed scenario explains its disabled selector'
	).toBeVisible();
}

async function assertComposerPresentation(component: Locator, variant: string) {
	await expect(component.getByRole('textbox', { name: 'Message' })).not.toHaveValue(
		/synthetic request kept for this capture/i
	);
	const modes: Record<string, string> = {
		ask: 'Ask',
		plan: 'Plan',
		change: 'Change',
		'visual-plan': 'Plan'
	};
	if (modes[variant])
		await expect(
			component.getByRole('button', { name: modes[variant], exact: true })
		).toHaveAttribute('aria-pressed', 'true');
	if (variant === 'visual-plan')
		await expect(component.getByRole('textbox', { name: 'Message' })).toHaveValue(/visual/i);
	if (variant === 'no-provider') {
		const model = component.getByRole('combobox', { name: 'Model', exact: true });
		await expect(model).toBeDisabled();
		await expect(
			model.locator('option:checked'),
			'No provider has a readable model placeholder'
		).toHaveText('No model');
	}
	if (variant === 'retry')
		await expect(
			component.getByRole('alert'),
			'Failed send keeps a visible retry cue'
		).toContainText(/couldn.t send|try again/i);
	if (variant === 'visual-plan')
		await expect(
			component.getByText('Visual plan · 3 design options', { exact: true }),
			'Visual plans show the design option count'
		).toBeVisible();
	if (variant === 'running') await expect(component.getByText(/agent is running/i)).toBeVisible();
}

async function assertStatusPresentation(component: Locator, variant: string) {
	const messages: Record<string, RegExp> = {
		failed: /verification failed/i,
		unknown: /status is unknown/i,
		unverified: /not been verified/i,
		'no-reason': /no verification recorded for this revision/i
	};
	const status = component.getByRole('status');
	if (messages[variant]) await expect(status).toHaveText(messages[variant]);
	if (variant === 'long') {
		const sentences = (await status.innerText())
			.split(/[.!?]+/)
			.map((sentence) => sentence.trim())
			.filter(Boolean);
		expect(
			new Set(sentences).size,
			'Long explanations contain distinct meaningful sentences'
		).toBeGreaterThanOrEqual(3);
	}
}
