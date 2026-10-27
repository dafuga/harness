import { posix } from 'node:path';
import { TestContractService } from '../../../../../services/verification-evidence/TestContractService';
import type { RevisionSide } from '../../../../loadRevisions';
import type { CheckOutcome } from '../check-run-service/CheckRunService';

/** Judge the exact selected cases, even when a successful command emitted no observations. */
export function caseGate(head: RevisionSide, revision: string, outcomes: CheckOutcome[]): string[] {
	return outcomes
		.filter(({ check }) => !check.id.startsWith('setup-'))
		.flatMap(({ check, entry, gathered }) => {
			const scenario = head.scenarios.find((item) => item.id === check.scenario);
			const references =
				scenario?.tests.find((item) => `${scenario.id}:${item.id}` === check.id)?.cases ?? [];
			const targets = [check.target, posix.join(check.cwd, check.target)];
			const selected = head.stored.flatMap((unit) =>
				(unit.testing?.cases ?? [])
					.filter(
						(item) =>
							targets.includes(item.test.file) ||
							references.some(
								(reference) => reference.unit === unit.id && reference.case === item.id
							)
					)
					.map((item) => item.test.file)
			);
			const visual =
				head.config.testing === 1 ? visualObservation(scenario, check, gathered) : undefined;
			const execution = {
				revision,
				files: selected,
				outcomes: entry.cases?.outcomes ?? [],
				visual
			};
			return new TestContractService()
				.validate({
					units: head.stored,
					scenarios: head.scenarios,
					files: new Set(head.entries.map((item) => item.path)),
					required: head.config.testing === 1,
					execution
				})
				.map((failure) => `${check.id}: ${failure}`);
		});
}

function visualObservation(
	scenario: RevisionSide['scenarios'][number] | undefined,
	check: CheckOutcome['check'],
	gathered: CheckOutcome['gathered']
) {
	if (!scenario) return undefined;
	return {
		scenario: scenario.id,
		check: check.name,
		captures: gathered.flatMap(({ line, capture }) =>
			line.kind === 'screenshot'
				? [
						{
							evidence: line.evidence,
							kind: line.kind,
							state: line.state,
							viewport: line.viewport,
							sha256: capture.sha256,
							note: line.note,
							provenance: line.provenance,
							server: line.server
						}
					]
				: []
		)
	};
}
