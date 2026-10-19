import type { ExplorerHistoryDetail } from "../../../models/Explorer.types.ts";
import type { HarnessRevision } from "../../../models/Harness.types.ts";
import { explorerChange } from "../../../utils/explorerEntities";
import { explorerVerdict } from "../../../utils/explorer-verdict/explorerVerdict";

/**
 * What one stored revision says about an entity: whether its commit changed it against its first
 * parent, the version of it there, the reasons recorded for the change and whether it is proven.
 * A revision without a registry or without a stored impact does not say whether it changed.
 */
export function historyDetail(detail: HarnessRevision, unit: string): ExplorerHistoryDetail {
	const found = detail.registry.units.find((item) => item.id === unit && item.status === 'active');
	return {
		known: detail.registry.available && Boolean(detail.sourceImpact),
		...(detail.regressions?.length ? { regressions: detail.regressions } : {}),
		present: Boolean(found),
		change: explorerChange(detail, unit),
		version: found?.version ?? null,
		explanations: detail.explanations.filter((item) => item.unit === unit),
		verdict: found ? explorerVerdict(found, detail) : null
	};
}
