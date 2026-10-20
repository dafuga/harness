import type { ScenarioResult, VerificationRecord } from '../../../core/verificationTypes';

/** An unaffected scenario keeps the evidence of the revision that last tested it. */
export function referencedScenario(
	prior: VerificationRecord,
	id: string
): ScenarioResult | undefined {
	const found = prior.scenarios.find((scenario) => scenario.id === id);
	if (!found || found.status === 'failed') return undefined;
	return { ...found, status: 'referenced', referencedRecord: found.referencedRecord ?? prior.id };
}
