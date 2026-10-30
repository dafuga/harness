import { example, type PreviewCases } from './shared';

/** Documented calls preserve setup, missing calls, failures and different results. */
export const usageExampleCatalogVariants: Record<string, string[]> = {
	'reports.component.usage-examples-usage-examples': [
		'setup',
		'inline-setup',
		'setup-only',
		'multiple',
		'missing-call',
		'error',
		'void'
	]
};

/** Use fictional documented examples without executing their source. */
export function usageExamplesVariant(props: PreviewCases[string], variant: string) {
	const setup = 'const seconds = 90;';
	const withSetup = { ...example, call: 'formatDuration(seconds)' };
	if (variant === 'setup' || variant === 'inline-setup')
		return {
			...props,
			examples: [withSetup],
			setup,
			...(variant === 'setup' ? { setupTitle: 'Prepare the duration' } : {})
		};
	if (variant === 'setup-only')
		return { ...props, examples: [], setup, setupTitle: 'Prepare the duration' };
	if (variant === 'multiple')
		return {
			...props,
			examples: [
				example,
				{
					name: 'Format a minute',
					call: 'formatDuration(60)',
					input: { seconds: 60 },
					output: '1:00'
				}
			]
		};
	if (variant === 'missing-call')
		return {
			...props,
			examples: [{ name: 'Format a duration', input: { seconds: 90 }, output: '1:30' }]
		};
	if (variant === 'error')
		return {
			...props,
			examples: [
				{
					name: 'Reject incomplete JSON',
					call: 'JSON.parse("{")',
					input: { text: '{' },
					error: 'SyntaxError: Unexpected end of JSON input'
				}
			]
		};
	if (variant === 'void')
		return {
			...props,
			setup: 'const counts = new Map([["orders", 3]]);',
			examples: [{ name: 'Clear saved counts', call: 'counts.clear()', input: {} }]
		};
	return null;
}
