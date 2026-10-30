import { cardPicture, viewerBaseline, viewerRelease } from './reportData';
import type { Evidence } from '../../../../src/models/Report.types';

/** Fictional checkout captures and a paired review recording for one gallery. */
export const evidenceGridItems: Evidence[] = [
	cardPicture,
	{
		...cardPicture,
		id: 'checkout-mobile',
		title: 'Checkout on mobile',
		file: 'checkout-mobile.svg',
		viewport: 'Mobile',
		provenance: [{ label: 'Viewport', value: 'Mobile' }]
	},
	{
		...cardPicture,
		id: 'checkout-tablet',
		title: 'Checkout on tablet',
		file: 'checkout-tablet.svg',
		viewport: 'Tablet',
		provenance: [{ label: 'Viewport', value: 'Tablet' }]
	},
	{ ...viewerBaseline, comparison: 'release-narration' },
	{ ...viewerRelease, comparison: 'release-narration' }
];
