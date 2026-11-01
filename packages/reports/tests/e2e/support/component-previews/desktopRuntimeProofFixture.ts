import type { DesktopData } from './desktopData.svelte';
import type { RegressionView } from '../../../../../../src/core/regressionTypes';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';

/** Ready and offline OrderCard records retain the regression that made their layout readable. */
export function prepareDesktopRuntimeProof(data: DesktopData) {
	const result = data.visualEvidence.result;
	if (!result?.evidence.after.detail)
		throw new Error('Order-card evidence must be ready before its proof is supplied.');
	data.visualEvidence.result = {
		...result,
		evidence: {
			...result.evidence,
			after: {
				...result.evidence.after,
				detail: {
					...result.evidence.after.detail,
					regressions: [orderCardRegression(data.visualEntity.id)]
				}
			}
		}
	};
}

function orderCardRegression(unit: string): RegressionView {
	const command = 'bunx playwright test tests/order-card.spec.ts';
	const assertion = 'Order titles and delivery status remain readable at narrow widths.';
	return {
		loop: 'order-card-delivery-status',
		units: [unit],
		red: {
			commit: commits.first,
			status: 'failed',
			command,
			assertion,
			output: 'The delivery status overlapped the order title at mobile width. 1 failed, 2 passed.',
			finishedAt: '2026-10-09T09:40:00Z'
		},
		green: {
			commit: commits.middle,
			status: 'passed',
			command,
			assertion,
			output: '3 viewports passed: desktop, tablet and mobile retain each title and status.',
			finishedAt: '2026-10-10T10:24:00Z'
		}
	};
}
