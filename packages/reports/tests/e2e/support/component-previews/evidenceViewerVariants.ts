import type { PreviewCases } from './shared';

/** Keep the evidence viewer's comparison fixtures together outside the catalog router. */
export function evidenceViewerVariant(props: PreviewCases[string], variant: string) {
	const selected = props.selected as Record<string, unknown>;
	if (variant === 'unavailable') {
		const unavailable = {
			...selected,
			missing: true,
			note: 'The recorded screenshot could not be restored.'
		};
		return {
			...props,
			items: [unavailable],
			navigableItems: [unavailable],
			selected: unavailable
		};
	}
	const before = {
		...selected,
		id: 'checkout-before',
		title: 'Checkout before release',
		comparison: 'checkout-flow',
		phase: 'before'
	};
	const after = {
		...selected,
		id: 'checkout-after',
		title: 'Checkout after release',
		comparison: 'checkout-flow',
		phase: 'after'
	};
	return { ...props, items: [before, after], navigableItems: [after], selected: after };
}
