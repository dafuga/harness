import { expect, type Locator } from '@playwright/test';

/** Exercise the roster and declaration disclosures before capturing their states. */
export async function prepareActivityAgentState(component: Locator, variant: string) {
	const labels: Record<string, string> = {
		gone: 'Process ended',
		completed: 'Finished',
		failed: 'Failed',
		'details-open': 'Finished'
	};
	if (labels[variant])
		await expect(component.getByText(labels[variant], { exact: true })).toBeVisible();
	if (variant === 'stale') {
		await expect(component.getByTestId('agents-working')).toHaveText('Unknown');
		await expect(component.getByText('Stale', { exact: true })).toBeVisible();
	}
	if (variant === 'empty-roster')
		await expect(component.getByTestId('agents-working')).toHaveText('0');
	if (variant === 'unstated') await expect(component.getByText('Model not stated')).toBeVisible();
	if (variant === 'details-open') {
		await component.getByText('What it stated', { exact: true }).click();
		await expect(component.getByText('Task: Capture component states')).toBeVisible();
	}
	if (variant === 'many-units' || variant === 'expanded-units') {
		const more = component.getByText('and 2 more', { exact: true });
		await expect(more).toBeVisible();
		if (variant === 'expanded-units') {
			await more.click();
			await expect(component.getByText('not in the registry')).toBeVisible();
		}
	}
	if (variant === 'many-agents' || variant === 'expanded-agents') {
		const list = component.getByRole('list', { name: 'Agent roster' });
		await expect(list.locator('li:visible')).toHaveCount(5);
		if (variant === 'expanded-agents') {
			await component.getByRole('button', { name: 'Show all 6 agents' }).click();
			await expect(list.locator('li:visible')).toHaveCount(6);
		}
	}
}
