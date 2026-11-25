// @harness-uid u_wwerrde2nk
import { fail } from '../../../core/development-tooling/errors';
import { isDeepStrictEqual } from 'node:util';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { createLoop } from '../../manageLoop';
import { scanSecurityClass } from './scanSecurityClass';
import { securityReviewSchema } from './securityReviewSchemas';
import { readSecurityJson } from './securityReviewer';
import type { SecurityReviewBudget } from './securityReviewBudget';

export async function prepareSecurityRepair(
	root: string,
	reviewPath: string,
	findingId: string,
	budget: SecurityReviewBudget
) {
	const review = securityReviewSchema.parse(await readSecurityJson(reviewPath, budget.signal));
	const matches = review.findings.filter(({ id }) => id === findingId);
	const [finding] = matches;
	if (matches.length !== 1 || finding.verdict !== 'confirmed')
		fail('Prepare repair only for a uniquely confirmed revalidated finding.');
	const git = new GitAdapter(root);
	await requireCurrentRevision(git, review.revision, budget.signal);
	const scan = await scanSecurityClass({ root, ...review }, budget);
	const { verdict, evidence, impact } = finding;
	if (
		!scan.report.candidates.some((site) =>
			isDeepStrictEqual({ ...site, verdict, evidence, impact }, finding)
		)
	)
		fail('The confirmed finding does not match the committed security candidate.');
	await requireCurrentRevision(git, review.revision, budget.signal);
	budget.checkTime();
	return createLoop({
		root,
		name: `security-${review.classId}-${findingId}`,
		kind: 'coding',
		from: 'bug-fix',
		goal: `Restore the security control for ${review.classId} at ${finding.path}:${finding.line} (${review.revision}). Revalidation: ${evidence}`
	});
}

async function requireCurrentRevision(git: GitAdapter, revision: string, signal: AbortSignal) {
	if ((await git.run(['rev-parse', 'HEAD'], { signal })) !== revision)
		fail('The finding is stale. Scan and revalidate the current HEAD before preparing repair.');
}
