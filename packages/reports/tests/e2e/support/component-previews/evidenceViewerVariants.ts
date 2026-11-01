import type { Evidence } from '../../../../src/models/reports-media/Report.types';
import type { PreviewCases } from './shared';
import { noop } from './shared';
import { cardPicture } from './reportData';

const after: Evidence = {
	...cardPicture,
	id: 'checkout-after',
	title: 'Checkout after release',
	comparison: 'checkout-flow',
	source: 'b56de78abc01234567890123456789012345678901',
	provenance: [
		{ label: 'Build', value: 'checkout-selected' },
		{ label: 'Viewport', value: 'Desktop' }
	]
};
const before: Evidence = {
	...after,
	id: 'checkout-before',
	title: 'Checkout before release',
	file: 'checkout-before.svg',
	phase: 'before',
	source: 'a12bc34deffedcba123456789012345678901234567',
	provenance: [
		{ label: 'Build', value: 'checkout-parent' },
		{ label: 'Viewport', value: 'Desktop' }
	]
};
const mobile: Evidence = {
	...after,
	id: 'checkout-mobile',
	title: 'Checkout on mobile',
	file: 'checkout-mobile.svg',
	viewport: 'Mobile',
	provenance: [{ label: 'Viewport', value: 'Mobile' }]
};
const tablet: Evidence = {
	...after,
	id: 'checkout-tablet',
	title: 'Checkout on tablet',
	file: 'checkout-tablet.svg',
	viewport: 'Tablet',
	provenance: [{ label: 'Viewport', value: 'Tablet' }]
};
export const evidenceViewerProps = {
	items: [before, after, mobile, tablet],
	navigableItems: [after, mobile, tablet],
	selected: after,
	assetBase: '/media/',
	onclose: noop,
	onselect: noop
};

/** Keep evidence selection and missing metadata cases on realistic checkout captures. */
export function evidenceViewerVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'missing-after')
		return { ...props, items: [before], navigableItems: [before], selected: before };
	if (variant === 'unselected') return { ...props, selected: null };
	if (variant === 'no-navigation') return { ...props, navigableItems: [] };
	if (variant === 'no-pair') return { ...props, items: [after], navigableItems: [after] };
	if (variant === 'no-provenance') {
		const selected = { ...after, provenance: undefined };
		return { ...props, items: [selected], navigableItems: [selected], selected };
	}
	if (variant === 'unavailable') {
		const selected = {
			...after,
			missing: true,
			note: 'The recorded screenshot could not be restored.'
		};
		return { ...props, items: [selected], navigableItems: [selected], selected };
	}
	return props;
}
