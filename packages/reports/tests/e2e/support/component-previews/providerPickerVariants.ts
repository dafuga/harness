import type { PreviewCases } from './shared';

/** The same public props accompany each protocol-driven picker state. */
export function providerPickerVariant(props: PreviewCases[string], variant: string) {
	return variant ? { ...props } : null;
}
