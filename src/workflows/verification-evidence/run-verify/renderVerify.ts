// @harness-uid u_srtmrphmgz
import type { VerifyResult } from './runVerify.types';
import { renderAttachment } from './scopedVerify';

export function renderVerify(stored: VerifyResult): string {
	const { record } = stored;
	const referenced = record.scenarios.filter((scenario) => scenario.status === 'referenced').length;
	const pending = record.scenarios.filter((scenario) => scenario.status === 'pending').length;
	const ran = record.scenarios.length - referenced - pending;
	const unresolved = record.lite ? `, ${pending} pending` : '';
	const { base, requestedBase } = record.source;
	const widened = requestedBase
		? [
				`Compared with ${base ?? 'an empty tree'}: ${requestedBase} has no passing record, so everything since the last verified revision was checked.`
			]
		: [];
	return [
		`${record.lite ? 'Lite verification' : 'Verification'} ${record.lite?.status ?? record.status} for ${record.source.commit}.`,
		...widened,
		`Tests: ${record.tests.length} run. Scenarios: ${ran} verified, ${referenced} referenced${unresolved}.`,
		...renderPending(record.lite),
		...record.failures.map((failure) => `  ${failure}`),
		`Record ${record.id.slice(0, 12)} in ${stored.directory}`,
		...renderAttachment(stored.attachment)
	].join('\n');
}

function renderPending(lite: VerifyResult['record']['lite']): string[] {
	if (!lite) return [];
	return [
		`Pending full verification: ${lite.pendingChecks.length} checks, ${lite.pendingEvidence.length} evidence slots, ${lite.pendingSetup.length} setup steps, ${lite.pendingTools.length} tools.`
	];
}
