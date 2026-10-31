import { expect, type Locator, type Page } from '@playwright/test';
import { desktopCatalogVariants } from './desktopCatalogVariants';
import { desktopGameCatalogVariants } from './desktopGameVariants';

/** Reach stateful Desktop presentations through their normal controls before capture. */
export async function prepareDesktopState(component: Locator, id: string, variant: string) {
	if (!variant) return;
	await actions[id.replace('desktop.component.', '')]?.(component, variant);
}

export function desktopCaptureEvidence(id: string, variant: string) {
	return id === 'desktop.component.project-agent' && variant
		? `project-agent-${variant}`
		: 'screens';
}

export function desktopCaptureDirectory(id: string) {
	return (
		process.env.COMPONENT_PREVIEW_SHOTS ??
		(id === 'desktop.component.status-icon' ? process.env.HARNESS_EVIDENCE_DIR : undefined)
	);
}

/** Keep fixture-only heading pixels out without moving the rendered component. */
export async function frameDesktopCapture(page: Page, id: string) {
	const owned =
		Object.hasOwn(desktopCatalogVariants, id) ||
		Object.hasOwn(desktopGameCatalogVariants, id) ||
		id === 'desktop.component.project-agent';
	if (owned) {
		await page.locator('#preview-title').evaluate((node: HTMLElement) => {
			node.style.visibility = 'hidden';
		});
		await expect(page.locator('#preview-title')).toBeHidden();
	}
}

const actions: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'agent-settings': settings,
	'agents-providers-chat-agents': roster,
	composer,
	'catalog-view': catalog,
	'entity-view': entity,
	'history-panel': history,
	'environment-picker': async (component, variant) => {
		if (['stage', 'preprod', 'prod'].includes(variant))
			await component.getByRole('combobox', { name: 'Environment' }).selectOption(variant);
	},
	'project-switcher': async (component, variant) => {
		if (['open', 'shared', 'empty'].includes(variant))
			await component.getByRole('button', { name: 'Choose workbench' }).click();
	},
	'revision-picker': async (component, variant) => {
		if (variant.endsWith('-open'))
			await component
				.getByRole('button', {
					name: variant === 'branch-open' ? 'Choose branch' : 'Choose commit'
				})
				.click();
	},
	'runtime-artifact': artifact,
	'status-icon': async (component, variant) => {
		if (['failed', 'unknown', 'unverified', 'no-reason', 'open', 'long'].includes(variant)) {
			await component.getByRole('button').focus();
			await expect(component.getByRole('status')).toBeVisible();
		}
	}
};

export async function prepareDesktopPage(page: Page, id: string, variant: string) {
	if (id === 'desktop.component.project-agent' && variant === 'visual-plan')
		await page.addInitScript(() =>
			localStorage.setItem('harness.agent-settings.v1', JSON.stringify({ designOptions: 7 }))
		);
	if (id === 'desktop.component.agent-settings' && variant === 'not-saved')
		await page.addInitScript(() => {
			Storage.prototype.setItem = () => {
				throw new Error('Synthetic unavailable device storage');
			};
		});
}

async function settings(component: Locator, variant: string) {
	await component.getByRole('combobox', { name: 'Design options' }).selectOption('7');
	await expect(component.getByRole('combobox')).toHaveValue('7');
	if (variant === 'not-saved')
		await expect(component.getByRole('alert')).toContainText('Not saved');
}
async function composer(component: Locator, variant: string) {
	if (['running', 'no-modes'].includes(variant)) return;
	const modes: Record<string, string> = {
		plan: 'Plan',
		ask: 'Ask',
		change: 'Change',
		'visual-plan': 'Plan'
	};
	if (modes[variant])
		await component.getByRole('button', { name: modes[variant], exact: true }).click();
	const requests: Record<string, string> = {
		plan: 'Plan the next checkpoint editor change.',
		ask: 'Where is the current checkpoint saved?',
		change: 'Update the checkpoint title to Collect the key.',
		'visual-plan': 'Create visual options for the checkpoint editor.'
	};
	await component
		.getByRole('textbox', { name: 'Message' })
		.fill(requests[variant] ?? 'A synthetic request kept for this capture.');
	if (variant === 'retry') {
		await component.getByRole('button', { name: 'Send comment' }).click();
		await expect(component.getByRole('textbox')).toHaveValue(
			'A synthetic request kept for this capture.'
		);
	}
}
async function catalog(component: Locator, variant: string) {
	if (variant === 'search-empty')
		await component.getByRole('searchbox').fill('No matching component');
	if (variant === 'filters-open')
		await component.getByRole('button', { name: 'Filters', exact: true }).click();
	if (['empty', 'search-empty'].includes(variant))
		await expect(component.locator('.empty')).toContainText('No components match');
}
async function history(component: Locator, variant: string) {
	if (!['more', 'loading', 'error'].includes(variant)) return;
	const more = component.getByRole('button', { name: 'Load more history' });
	await more.click();
	if (variant === 'loading') await expect(more).toBeDisabled();
	if (variant === 'error')
		await expect(component.getByRole('alert')).toContainText('Synthetic earlier history');
	if (variant === 'more') await expect(more).toHaveCount(0);
}
async function artifact(component: Locator, variant: string) {
	if (!['text', 'recorded-open', 'json-open'].includes(variant)) return;
	await component.getByText('Assertions and recorded result', { exact: true }).click();
	if (variant === 'json-open') await component.getByText('Recorded JSON', { exact: true }).click();
	await expect(component.locator('details[open]')).not.toHaveCount(0);
}

async function entity(component: Locator, variant: string) {
	if (variant === 'conversation-closed') {
		const close = component.getByRole('button', { name: 'Close conversation' });
		if (await close.isVisible()) await close.click();
		await expect(
			component.getByRole('button', { name: 'Conversation', exact: true })
		).toBeVisible();
		return;
	}
	const tabs: Record<string, string> = {
		source: 'Source',
		designs: 'Designs',
		'used-in': 'Used In',
		uses: 'Uses',
		apis: 'APIs',
		states: 'States',
		history: 'History',
		'helper-examples': 'Examples'
	};
	if (tabs[variant])
		await expect(
			component
				.getByRole('navigation', { name: 'Entity sections' })
				.getByRole('button', { name: tabs[variant], exact: true })
		).toHaveAttribute('aria-current', 'page');
}

async function roster(component: Locator, variant: string) {
	if (variant === 'refresh-error') {
		await expect(component).toContainText('1 working');
		await component.getByRole('button', { name: 'Refresh agents' }).click();
		await expect(component).toContainText('Could not refresh. Showing the last reading.');
	}
	const messages: Record<string, string> = {
		'never-used': 'No agent has registered here yet',
		'stale-reading': 'Not confirmed',
		loading: 'Reading agent activity…',
		unavailable: 'Live agent activity is unavailable',
		empty: 'No sessions are registered',
		unreadable: '1 unreadable registrations',
		stale: 'Stale',
		historical: 'Live activity · independent of this revision',
		many: '8 working'
	};
	if (messages[variant]) await expect(component).toContainText(messages[variant]);
	if (variant === 'many')
		await component.getByRole('button', { name: 'Show all 8 sessions' }).click();
}
