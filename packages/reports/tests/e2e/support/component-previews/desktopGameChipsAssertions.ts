import { expect, type Locator } from '@playwright/test';

const chips: Record<string, string> = {
	dirty: 'Unsaved changes',
	demo: 'Demo',
	readonly: 'Read-only',
	'with-commit': 'History · c725e93'
};
/** Demo and unsaved changes are the gold chips; the others keep the neutral text color. */
const goldStates = ['dirty', 'demo'];

/** Each chip state shows exactly the chip it names; the default state is the unsaved-changes chip. */
export async function assertGameWorkspaceChips(component: Locator, variant: string) {
	const shown = variant || 'dirty';
	for (const [state, label] of Object.entries(chips)) {
		const chip = component.getByText(label, { exact: true });
		if (state === shown) await expect(chip, `${label} is shown`).toBeVisible();
		else await expect(chip, `${label} is not shown`).toHaveCount(0);
	}
	await assertChipPaint(component, shown);
}

/** The painted color proves the caller's chip styles loaded, not just the text. */
async function assertChipPaint(component: Locator, shown: string) {
	const primary = await component.page().evaluate(() => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--hx-color-primary)';
		document.body.append(probe);
		const color = getComputedStyle(probe).color;
		probe.remove();
		return color;
	});
	const chip = component.getByText(chips[shown], { exact: true });
	if (goldStates.includes(shown))
		await expect(chip, `${chips[shown]} is painted in the primary color`).toHaveCSS(
			'color',
			primary
		);
	else
		await expect(chip, `${chips[shown]} keeps the neutral text color`).not.toHaveCSS(
			'color',
			primary
		);
}
