import type { PreviewCases } from './shared';

/** Supply real-looking capture facts, including a long value and missing metadata. */
export function evidenceProvenanceVariant(props: PreviewCases[string], variant: string) {
	const item = props.item as Record<string, unknown>;
	const facts: Record<string, Array<{ label: string; value: string }> | undefined> = {
		extended: [
			{ label: 'Viewport', value: 'Desktop · 1440 × 900' },
			{ label: 'Browser', value: 'Chromium 142' },
			{ label: 'Capture', value: 'Checkout confirmation review' },
			{ label: 'Revision', value: '7c4a8d09e1b2' }
		],
		single: [{ label: 'Source', value: 'Chromium capture' }],
		long: [
			{
				label: 'Source',
				value:
					'Checkout confirmation captured after the order was completed in the release candidate.'
			},
			{ label: 'Revision', value: '7c4a8d09e1b236fa7532cb8e462d1f975abc0031' }
		],
		empty: [],
		absent: undefined
	};
	return variant in facts ? { ...props, item: { ...item, provenance: facts[variant] } } : props;
}
