import type { SourceImpact } from './sideImpact.types';
import type { ImpactReport } from '../../core/development-tooling/impactTypes';
import {} from '../../core/development-tooling/unitsConfig';

export function impactView(report: ImpactReport, base: string | null): SourceImpact {
	return {
		base,
		expanded: report.expanded,
		units: report.units,
		scenarios: report.scenarios.affected,
		uncertain: report.uncertain,
		changed: report.changed
	};
}

export { storedSide } from '../../services/explorer-ui/revision-detail-service/source-impact-service/sideImpact';
export { sideImpact } from '../../../packages/reports/src/components/explorer-ui/harness-compare/sideImpact';

export type { StoredSide, SourceImpact } from './sideImpact.types';
