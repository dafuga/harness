// @harness-uid u_xghv2ih7cg
import { join } from 'node:path';
import { runTaskCheck } from '../module-task-worker-service/taskCheck';
import { CompletionCheckError } from './CompletionCheckError';
import { requireNondecreasingCoverage } from './lcovCoverage';
import { moduleCompletionMeasurement } from './moduleCompletionMeasurement';
import type { ModuleCandidate, ModuleReductionAssessment } from './moduleCompletion.types';

/** A measured candidate must retain coverage and clear the baseline's checks to be applied. */
export async function assessReduction(
	candidate: ModuleCandidate,
	assessment: ModuleReductionAssessment
) {
	const { input, scratch } = candidate;
	const { proposed, paths, receipt, measure } = assessment;
	try {
		await moduleCompletionMeasurement(
			measure,
			proposed,
			join(candidate.reportDirectory, 'after'),
			(reading) => (receipt.after = reading)
		);
		const { before, after } = receipt;
		const tests = input.task.verificationFiles ?? [];
		requireNondecreasingCoverage(
			before!.coverage!,
			after!.coverage!,
			paths.filter((path) => !tests.includes(path))
		);
		if (!paths.length) {
			receipt.disposition = 'unchanged';
			return true;
		}
		if (after!.bytes.source >= before!.bytes.source || after!.bytes.tests >= before!.bytes.tests)
			throw new CompletionCheckError('The candidate did not reduce both source and test bytes.');
		if (input.task.check) {
			const { receipt: check } = await runTaskCheck(
				input.task.check,
				scratch.root,
				input.context.signal
			);
			receipt.candidateCheck = check;
			if (check.status !== 'passed')
				throw new CompletionCheckError(
					`The candidate's declared check ended with status ${check.status}.`
				);
		}
		return true;
	} catch (error) {
		if (input.context.signal.aborted || !(error instanceof CompletionCheckError)) throw error;
		receipt.reason = error.message;
		return false;
	}
}
