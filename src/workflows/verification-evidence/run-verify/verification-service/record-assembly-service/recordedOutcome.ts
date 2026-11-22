// @harness-uid u_33ugo6gwgh
import type { VerificationRecord } from '../../../../../core/verification-evidence/verificationTypes';
import type { AssemblyInput } from './RecordAssemblyService.types';

export function outcome(failures: string[]): 'passed' | 'failed' {
	return failures.length === 0 ? 'passed' : 'failed';
}

/** The checked outcomes, including exact deferred work when the Lite profile ran. */
export function recordedOutcome(
	input: AssemblyInput,
	gates: Record<string, string[]>
): Pick<VerificationRecord, 'status' | 'lite' | 'tests' | 'scenarios' | 'gates' | 'failures'> {
	const failures = Object.values(gates).flat();
	const lite = liteReceipt(input, failures);
	return {
		status: lite ? ('failed' as const) : outcome(failures),
		...(lite ? { lite } : {}),
		tests: input.executed.outcomes
			.filter((item) => !item.check.id.startsWith('setup-'))
			.map((item) => item.entry),
		scenarios: judgedScenarios(input),
		...recordedGates(gates, failures, Boolean(lite))
	};
}

function liteReceipt(input: AssemblyInput, failures: string[]): VerificationRecord['lite'] {
	if (!input.lite) return undefined;
	return {
		...input.lite,
		status: outcome(failures),
		pendingEvidence: input.scenarios.flatMap(({ pending }) => pending ?? [])
	};
}

function judgedScenarios(input: AssemblyInput): VerificationRecord['scenarios'] {
	const all = [...input.scenarios.map((scenario) => scenario.result), ...input.referenced];
	return all.sort((left, right) => (left.id < right.id ? -1 : 1));
}

function recordedGates(gates: Record<string, string[]>, failures: string[], lite: boolean) {
	const outcomes = Object.fromEntries(
		Object.entries(gates).map(([gate, list]) => [gate, outcome(list)])
	);
	if (!lite) return { gates: outcomes, failures };
	return {
		gates: { ...outcomes, 'full-profile': 'failed' as const },
		failures: [
			...failures,
			'Lite verification is partial. Run the full profile to verify this commit.'
		]
	};
}
