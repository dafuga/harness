import type { VerificationRecord } from "../../../../../src/core/verificationTypes";
import { revisionSummary } from "../../../../../src/utils/revisionSummary";
import { revisionReasons } from "../../../../../src/utils/revisionReasons";
import type { HarnessRevision } from "../../../../reports/src/models/Harness.types.ts";
import type { HubRecordStatusService } from "../../services/HubRecordStatusService";
import type { HubSourceContext } from "../hubSource";
import { hubPinnedSource } from "../hubPinnedSource";
import { hubEvidenceRegistry } from "./hubEvidenceRegistry";
import { hubEvidenceViews } from "./hubEvidenceViews";
import { hubFail } from "../hubJson";
import { regressionHistory } from "../../../../../src/utils/regressionHistory";

export async function hubEvidenceRevision(
	base: HubSourceContext,
	history: HubRecordStatusService,
	commit: string
) {
	const facts = await base.source.facts?.(base.repository, commit);
	if (!facts || facts.commit !== commit) return hubFail('evidence-unreadable');
	const context = commit === base.commit ? base : await hubPinnedSource(base, commit);
	const status = await history.status(commit);
	const views = await hubEvidenceViews(history, status.records);
	const note = (await history.all()).get(commit);
	const noted =
		note?.entries.flatMap((entry) => (entry.kind === 'reason' ? [entry.explanation] : [])) ?? [];
	const originals = await Promise.all(
		status.records.filter((item) => item.valid).map((item) => history.attached.load(item.evidence))
	);
	const records = originals.flatMap((item) => (item.record ? [item.record] : []));

	const reasons = revisionReasons({
		parent: facts.parents[0] ?? null,
		own: undefined,
		noted,
		records: records.map((record) => ({
			base: record.source.base,
			entries: record.reasons.entries ?? []
		}))
	});
	const detail = {
		commit,
		registry: await hubEvidenceRegistry(context),
		comparison: comparison(records),
		sourceImpact: null,
		records: views,
		explanations: reasons.explanations,
		regressions: await regressionHistory(commit, await history.all(), (note) =>
			history.attached.regression(note)
		)
	} as unknown as HarnessRevision;
	return {
		facts,
		detail,
		judged: revisionSummary(status, views),
		legacy:
			note?.entries.flatMap((entry) => (entry.kind === 'legacy-report' ? [entry.id] : [])) ?? []
	};
}

function comparison(records: VerificationRecord[]) {
	const selected = records.find((item) => item.status === 'passed') ?? records[0];
	if (!selected) return null;
	return {
		base: selected.source.base,
		record: selected.id,
		units: selected.impact.units,
		changed: selected.impact.changed,
		uncertain: selected.impact.uncertain,
		scenarios: selected.scenarios
			.filter((item) => item.status !== 'referenced')
			.map((item) => item.id)
	};
}
