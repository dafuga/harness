import type { FeatureWorkSnapshot } from '../../../../../../src/services/agents-providers/FeatureWorkService.types';

/** Deterministic queue data for the Work components' standalone catalog previews. */
export const workFeature: FeatureWorkSnapshot['features'][number] = {
	id: 'checkout',
	goal: 'Improve checkout',
	tldr: 'Build the total before the page.',
	plan: null,
	tasks: [
		{
			id: 'checkout.total',
			title: 'Calculate the total',
			module: 'service.total',
			status: 'running',
			dependsOn: [],
			blockedBy: [],
			belongsToPlan: false
		},
		{
			id: 'checkout.page',
			title: 'Update the checkout page',
			module: 'page.checkout',
			status: 'queued',
			dependsOn: ['checkout.total'],
			blockedBy: ['checkout.total'],
			belongsToPlan: false
		}
	]
};

export const workSnapshot: FeatureWorkSnapshot = {
	queueCommit: 'a'.repeat(40),
	features: [workFeature]
};
