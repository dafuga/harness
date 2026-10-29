import { expect, type Locator } from '@playwright/test';

/** A catalog state must show the authored example or the exact documentation gap. */
export async function assertEntityExamplesState(component: Locator, variant: string) {
	const words: Record<string, string> = {
		empty: 'No usage examples are documented at this commit.',
		gap: 'The documented examples are malformed.',
		setup: 'Create the formatter',
		'inline-setup': 'const formatter = new Intl.NumberFormat',
		'missing-setup': 'How to create it is not documented at this commit.',
		error: '// throws',
		'missing-call': '// Call not documented',
		void: '// => undefined'
	};
	if (words[variant])
		await expect(component.getByText(words[variant], { exact: false })).toBeVisible();
}
