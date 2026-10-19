import type { HarnessRevisionSummary } from "../../../models/Harness.types.ts";

const coverage = {
	verified: 'verified',
	failed: 'failed',
	invalid: 'evidence unusable',
	unverified: 'no evidence'
};

/** How a commit reads in a selector: its short hash, its subject and what proves it. */
export function revisionLabel(item: HarnessRevisionSummary): string {
	return `${item.commit.slice(0, 7)} ${item.subject} · ${coverage[item.coverage]}`;
}
