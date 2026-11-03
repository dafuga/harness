import { expect, type Locator } from '@playwright/test';

const chips: Record<string, string> = {
	dirty: 'Unsaved changes',
	demo: 'Demo',
	readonly: 'Read-only',
	'with-commit': 'History · c725e93'
};

/** Each chip state shows exactly the chip it names; the default state is the unsaved-changes chip. */
export async function assertGameWorkspaceChips(component: Locator, variant: string) {
	const shown = variant || 'dirty';
	for (const [state, label] of Object.entries(chips)) {
		const chip = component.getByText(label, { exact: true });
		if (state === shown) await expect(chip, `${label} is shown`).toBeVisible();
		else await expect(chip, `${label} is not shown`).toHaveCount(0);
	}
}
