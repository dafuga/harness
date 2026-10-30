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
	'request-cancelled',
	'bind-ready',
	'binding',
	'queueing',
	'cancelling',
	'loading-queue',
	'no-models',
	'in-use'
];

/** The same public props accompany each protocol-driven picker state. */
export function providerPickerVariant(props: PreviewCases[string], variant: string) {
	return variant ? { ...props } : null;
}
