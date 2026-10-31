import { expect, type Locator } from '@playwright/test';
import { commits } from '../../../../test/entityUnits';

/** Check the actual state branches, so a successful screenshot cannot silently show the default. */
export async function assertDesktopState(component: Locator, id: string, variant: string) {
	const key = id.replace('desktop.component.', '') + ':' + variant;
	const messages: Record<string, string> = {
		'design-panel:empty': 'No design image yet',
		'design-panel:headless': 'No plan yet',
		'design-panel:headless-plan': 'Planned behavior',
		'design-panel:long': 'A detailed design direction.',
		'design-panel:loading': 'Loading design image…',
		'design-panel:error': 'Synthetic image read refused.',
		'history-panel:empty': 'No history recorded for this entity.',
		'history-panel:incomplete': 'Earlier history is not loaded here.',
		'history-panel:long': 'A detailed history event.',
		'runtime-artifact:missing': 'Not recorded',
		'runtime-artifact:unstored': 'The original bytes were not retained.',
		'runtime-artifact:loading': 'Reading what it holds…',
		'runtime-artifact:unreadable': 'Synthetic artifact hash mismatch.',
		'runtime-artifact:text': 'Recorded plain text output.',
		'runtime-screens:incomparable': 'different runtime profiles',
		'runtime-evidence:error': 'Synthetic evidence read refused.',
		'runtime-evidence:offline': 'Saved'
	};
	if (messages[key]) await expect(component).toContainText(messages[key], { ignoreCase: true });
	await checks[id.replace('desktop.component.', '')]?.(component, variant);
}
const checks: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	composer,
	'environment-picker': async (component, variant) => {
		if (['stage', 'preprod', 'prod'].includes(variant))
			await expect(component.getByRole('combobox', { name: 'Environment' })).toHaveValue(variant);
	},
	'status-icon': async (component, variant) => {
		const failed = ['failed', 'unverified', 'unknown', 'no-reason', 'long'].includes(variant);
		await expect(component.getByRole('button')).toHaveText(failed ? '×' : '✓');
		if (['open', 'long'].includes(variant))
			await expect(component.getByRole('status')).toBeVisible();
	},
	'revision-picker': async (component, variant) => {
		if (['pinned', 'historical'].includes(variant))
			await expect(component.getByRole('button', { name: 'Go to tip' })).toBeVisible();
	},
	'nav-bar': async (component, variant) => {
		if (variant === 'readonly')
			await expect(component.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
	},
	'project-gate': async (component, variant) => {
		if (variant === 'busy')
			await expect(component.getByRole('button', { name: 'Open Project' })).toBeDisabled();
	}
};

async function composer(component: Locator, variant: string) {
	const box = component.getByRole('textbox', { name: 'Message' });
	if (['running', 'no-modes'].includes(variant)) await expect(box).toBeDisabled();
	const send = component.locator('button.send');
	if (['running', 'no-modes', 'unapproved', 'no-provider'].includes(variant))
		await expect(send).toBeDisabled();
	if (['plan', 'ask', 'change', 'visual-plan', 'retry', 'compact', 'long'].includes(variant))
		await expect(send).toBeEnabled();
	if (variant === 'ask') await expect(box).toHaveAttribute('placeholder', 'Ask a question…');
}

/** Validate painted state markers after capture, rather than accepting hidden state alone. */
export async function assertDesktopCapturedState(component: Locator, id: string, variant: string) {
	await assertPickerPresentation(component, id, variant);
	await assertLoadedHistory(component, id, variant);
	await assertLongCatalogContent(component, id, variant);
	if (id === 'desktop.component.composer') await assertComposerPresentation(component, variant);
	if (id === 'desktop.component.status-icon') await assertStatusPresentation(component, variant);
	if (id === 'desktop.component.game-preview' && variant === 'readonly') {
		await expect(
			component.getByRole('status').filter({ hasText: /AI/ }),
			'Read-only previews explain why AI video is disabled'
		).toContainText(/read-only/i);
		await expect(component.getByRole('button', { name: 'Reset', exact: true })).toBeEnabled();
	}
	if (id === 'desktop.component.game-create' && variant === 'unavailable') {
		await expect(component.getByRole('form', { name: 'New project' })).toBeVisible();
		await expect(component.getByText('This desktop app cannot create projects yet.')).toBeVisible();
		await expect(component.getByRole('button', { name: 'Create project' })).toBeDisabled();
	}
	if (id === 'desktop.component.game-checkpoint-pane' && variant === 'advanced') {
		const visible = await component
			.getByRole('region', { name: 'Rules', exact: true })
			.evaluate((node) => {
				const rules = node.getBoundingClientRect();
				const body = node.closest('.viewer-content')!.getBoundingClientRect();
				return rules.top >= body.top - 1 && rules.bottom <= body.bottom + 1;
			});
		expect(visible, 'Expanded checkpoint rules are fully visible above the footer').toBe(true);
	}
}

async function assertLongCatalogContent(component: Locator, id: string, variant: string) {
	const read: Record<string, () => Promise<string>> = {
		'desktop.component.game-level-brief': () =>
			component.getByRole('textbox', { name: 'Level brief', exact: true }).inputValue(),
		'desktop.component.history-panel': () => component.locator('article p').first().innerText()
	};
	if (variant !== 'long' || !read[id]) return;
	const sentences = (await read[id]())
		.split(/[.!?]+/)
		.map((sentence) => sentence.trim())
		.filter(Boolean);
	expect(
		new Set(sentences).size,
		'Long catalog content uses distinct meaningful sentences'
	).toBeGreaterThanOrEqual(3);
}

async function assertLoadedHistory(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.history-panel' && variant === 'more')
		await expect(
			component.getByText('Earlier API decision', { exact: true }),
			'Loading earlier history paints the returned event'
		).toBeVisible();
}

async function assertPickerPresentation(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.revision-picker' && variant === 'historical')
		await expect(
			component.locator('[aria-label="Viewed context"] strong'),
			'Historical revision names the older selected commit'
		).toHaveText(commits.middle.slice(0, 7));
	if (id !== 'desktop.component.project-switcher') return;
	if (variant === 'shared') {
		const project = component.getByRole('combobox', { name: 'Project', exact: true });
		await expect(project, 'Shared project is selected in the visible picker').toHaveValue(
			'shared-project'
		);
		await expect(project.locator('option:checked')).toHaveText('Shared workbench');
	}
	if (variant === 'busy') {
		await expect(component.getByRole('dialog')).toHaveCount(0);
		const add = component.getByRole('button', { name: 'Add local project', exact: true });
		await expect(add).toBeVisible();
		await expect(add).toBeDisabled();
	}
}

async function assertComposerPresentation(component: Locator, variant: string) {
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
