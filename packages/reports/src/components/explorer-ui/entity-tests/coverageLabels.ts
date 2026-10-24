import type { CoverageStanding } from '../../../models/explorer-ui/Explorer.types';

export const coverageLabels: Record<CoverageStanding, string> = {
	passed: 'Proven',
	failed: 'Failed',
	stale: 'Stale',
	missing: 'Evidence missing',
	incomplete: 'Coverage incomplete',
	inapplicable: 'Not applicable'
};
