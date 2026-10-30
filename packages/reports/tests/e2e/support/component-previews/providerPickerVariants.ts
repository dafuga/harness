import type { PreviewCases } from './shared';

export const providerPickerStates = [
	'loading',
	'connection-error',
	'unbound',
	'unobserved',
	'control-unavailable',
	'refreshing',
	'provider-claude',
	'queue-empty',
	'queue-populated',
	'queue-error',
	'cancelled',
	'applying',
	'applied',
	'failed',
	'request-cancelled'
];

/** The same public props accompany each protocol-driven picker state. */
export function providerPickerVariant(props: PreviewCases[string], variant: string) {
	return variant ? { ...props } : null;
}
