import type { Scenario } from './service.regression-proof.test.types';

export const unit = 'reports.component.evidence-grid';

export function scenario(): Scenario {
	return {
		schemaVersion: 1,
		id: 'reports.evidence-grid',
		title: 'Evidence grid in the reports view',
		kind: 'ui',
		units: [unit],
		states: [{ id: 'populated', title: 'Grid with recorded captures', coverage: 'required' }],
		viewports: [{ id: 'desktop', width: 1280, height: 800 }],
		tests: [{ id: 'reports.evidence-grid.e2e', kind: 'e2e', runner: 'playwright', target: 'x.ts' }],
		evidence: [
			{
				id: unit,
				kind: 'screenshot',
				states: ['populated'],
				viewports: ['desktop'],
				provenance: 'actual-capture',
				capture: 'viewport',
				required: true
			}
		]
	};
}
