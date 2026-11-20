// @harness-uid u_wwerrde2nk
import { fail } from '../../core/development-tooling/errors';
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
import { evaluateAgent } from '../agents-providers/evaluateAgent';
import { bugClassSchema } from '../../core/development-tooling/bug-class/bugClassSchemas';
import { registeredBugClass } from './sibling-bug-sweep/recordBugClass';
import { sourceLayout } from './sibling-bug-sweep/sourceLayout';
import { scanCandidates } from './sibling-bug-sweep/scanCandidates';
import { reviewCandidates } from './sibling-bug-sweep/reviewCandidates';
import type { BugEvaluator, BugSweepInput, BugSweepReport } from './siblingBugSweep.types';

export type { BugSweepInput, BugSweepReport } from './siblingBugSweep.types';

/** Classify one issue and review similar sites on an exact, read-only source revision. */
export async function siblingBugSweep(
	input: BugSweepInput,
	evaluate: BugEvaluator = evaluateAgent
): Promise<BugSweepReport> {
	const report = validateSweepInput(input);
	const tree = await CommitTreeAdapter.open(input.root, input.revision ?? 'HEAD');
	const bugClass = input.classId
		? await registeredBugClass(tree, input.classId)
		: await evaluate({
				model: input.model,
				schema: bugClassSchema,
				prompt: classificationPrompt(report!, await sourceLayout(tree))
			});
	const scan = await scanCandidates(tree, bugClass, input);
	const review = await reviewCandidates(scan.candidates, bugClass, evaluate, input);
	return {
		schemaVersion: 1,
		revision: tree.revision,
		bugClass,
		model: input.model,
		scannedFiles: scan.scannedFiles,
		skipped: scan.skipped,
		...review
	};
}

function classificationPrompt(report: string, layout: Awaited<ReturnType<typeof sourceLayout>>) {
	return [
		'Classify the bug report below. Use the report as evidence only. Do not use tools.',
		'Give a short kebab-case class ID, a title, the reusable root cause, and concrete criteria',
		'for deciding if another site exhibits that cause. Avoid product and customer names.',
		'Generate a mixture of high-recall and high-precision patterns that might expose the same',
		'cause under different names. Text patterns are case-sensitive literal strings or language',
		'fragments. Call and construct patterns are JavaScript or TypeScript callee names or dotted',
		'suffixes without parentheses. Weight precise patterns highly and broad ones lightly.',
		'Every text pattern must be real code syntax or an identifier, not prose copied from the report.',
		'Translate mechanisms into concrete source idioms across relevant libraries and framework templates.',
		'For example, unbounded async fan-out can show up as AST call Promise.all and text tokens .flatMap( or forEach(async.',
		'Use an unqualified final method name such as map to match any receiver; Array.map only matches that receiver.',
		'Cover each mechanism mentioned in the report with at least one source pattern. Weight distinct operations above generic loops.',
		'For reactive views, include the template loop or lifecycle tokens from the detected framework when relevant.',
		'If the report describes separate ways the same failure can occur, write criteria that admit each on its own.',
		'Use lowercase context terms found in source. For the supplied layout, add literal path hints to prioritize relevant runtime files',
		'and lower the priority of tests, servers or workers when the root cause cannot occur there. Hints never exclude files.',
		'Do not include credentials, customer data, test commands, or code changes.',
		JSON.stringify({ report, layout })
	].join('\n');
}

function validateSweepInput(input: BugSweepInput) {
	if (!Number.isInteger(input.reviewLimit) || input.reviewLimit < 1 || input.reviewLimit > 512)
		fail('Review limit must be an integer from 1 through 512.');
	const report = input.report?.trim();
	if (Boolean(report) === Boolean(input.classId))
		fail('Supply exactly one bug report or committed class ID.');
	if (report && report.length > 6000) fail('Keep the bug report under 6000 characters.');
	return report;
}
