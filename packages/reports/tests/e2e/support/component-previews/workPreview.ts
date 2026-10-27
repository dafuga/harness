import type { FeatureWorkSnapshot } from '../../../../../../src/services/agents-providers/FeatureWorkService.types';

const sourceCommit = 'a'.repeat(40);
const wantedContract = {
	responsibility: 'Keep checkout behavior consistent.',
	inputs: [{ name: 'order', type: 'Order' }],
	outputs: [{ name: 'result', type: 'Checkout' }],
	errors: []
};
const task = (id: string, title: string, module: string, dependsOn: string[] = []) => ({
	id,
	title,
	feature: 'checkout',
	module,
	role: 'implementation' as const,
	instructions: 'Implement the assigned checkout module.',
	wantedContract,
	model: 'auto',
	dependsOn
});

/** Deterministic queue data for the Work components' standalone catalog previews. */
export const workFeature: FeatureWorkSnapshot['features'][number] = {
	id: 'checkout',
	goal: 'Improve checkout',
	tldr: 'Build the total before the page.',
	plan: {
		feature: 'checkout',
		sourceCommit,
		revision: 1,
		goal: 'Improve checkout',
		tldr: 'Build the total before the page.',
		digest: 'c'.repeat(64),
		pages: [
			{
				module: 'page.checkout',
				selected: 'option-a',
				options: [
					{
						id: 'option-a',
						version: 'v001',
						commit: sourceCommit,
						path: 'designs/checkout-a.png',
						sha256: 'b'.repeat(64),
						preferred: true
					}
				]
			}
		],
		changes: [
			{ unit: 'page.checkout', kind: 'modify', assignedFiles: ['src/checkout.ts'], wantedContract },
			{
				unit: 'service.total',
				parent: 'page.checkout',
				kind: 'modify',
				assignedFiles: ['src/total.ts'],
				wantedContract
			},
			{
				unit: 'component.checkout-shell',
				parent: 'page.checkout',
				kind: 'modify',
				assignedFiles: ['src/shell.ts'],
				wantedContract
			}
		],
		tasks: [
			task('checkout.total', 'Calculate the total', 'service.total'),
			task('checkout.page', 'Update the checkout page', 'page.checkout', ['checkout.total']),
			task('checkout.shell', 'Prepare checkout shell', 'component.checkout-shell')
		]
	},
	tasks: [
		{
			id: 'checkout.total',
			title: 'Calculate the total',
			module: 'service.total',
			status: 'running',
			dependsOn: [],
			blockedBy: [],
			belongsToPlan: true
		},
		{
			id: 'checkout.page',
			title: 'Update the checkout page',
			module: 'page.checkout',
			status: 'queued',
			dependsOn: ['checkout.total'],
			blockedBy: ['checkout.total'],
			belongsToPlan: true
		},
		{
			id: 'checkout.shell',
			title: 'Prepare checkout shell',
			module: 'component.checkout-shell',
			status: 'accepted',
			dependsOn: [],
			blockedBy: [],
			belongsToPlan: true
		}
	]
};

export const workSnapshot: FeatureWorkSnapshot = {
	queueCommit: 'a'.repeat(40),
	features: [workFeature]
};
