import type { ExplorerHistoryDetail } from '../../../../models/explorer-ui/Explorer.types';
import type { HarnessRevision } from '../../../../models/explorer-ui/Harness.types';
import { explorerChange } from '../../../../utils/explorer-ui/explorerEntities';
import { explorerVerdict } from '../../../../utils/explorer-ui/explorer-verdict/explorerVerdict';

/**
 * What one stored revision says about an entity: whether its commit changed it against its first
 * parent, the version of it there, the reasons recorded for the change and whether it is proven.
 * A revision without a registry or without a stored impact does not say whether it changed.
 */
export function historyDetail(detail: HarnessRevision, unit: string): ExplorerHistoryDetail {
	const found = detail.registry.units.find((item) => item.id === unit && item.status === 'active');
	const source = (metric: string) =>
		found?.sourceMeasurements?.find(
			(item) => item.metric === metric && !item.workload && !item.profile
		)?.value ?? null;
	return {
		sourceSize: source('source-bytes'),
		sourceComplexity: source('complexity'),
		known: detail.registry.available && Boolean(detail.sourceImpact),
		...(detail.regressions?.length ? { regressions: detail.regressions } : {}),
		present: Boolean(found),
		change: explorerChange(detail, unit),
		version: found?.version ?? null,
		explanations: detail.explanations.filter((item) => item.unit === unit),
		verdict: found ? explorerVerdict(found, detail) : null
	};
}
