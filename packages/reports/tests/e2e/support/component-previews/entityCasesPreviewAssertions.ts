import { expect, type Locator } from '@playwright/test';

/** Each case fixture must actually reach the branch named in its screenshot slot. */
export async function assertEntityCasesState(component: Locator, variant: string) {
	const notes: Record<string, string> = {
		empty: 'No usage examples are documented at this commit.',
		unavailable: 'This result records no input and output.',
		malformed: 'Its cases are not in the recorded form.',
		'wrong-unit': 'Its cases are of another unit, app.function.format-duration.',
		recorded: 'Calls of formatDuration recorded by a test.',
		'recorded-error': 'Observed error',
		observed: 'What a test observed end to end',
		'observed-noncallable': 'What a test observed end to end.',
		'expected-error': 'Expected error'
	};
	if (notes[variant])
		await expect(component.getByText(notes[variant], { exact: false })).toBeVisible();
	if (variant === 'observed-noncallable')
		await expect(component).not.toContainText('not a direct call of this function');
	if (variant === 'expanded')
		await expect(component.locator('.cases > details')).toHaveAttribute('open');
}
