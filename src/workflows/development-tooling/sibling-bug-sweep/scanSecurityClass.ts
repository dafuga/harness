// @harness-uid u_wwerrde2nk
import { fail } from '../../../core/development-tooling/errors';
import { CommitFileNotFoundError } from '../../../adapters/git-source-history/CommitTreeAdapter.types';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { bugClassId } from '../../../core/development-tooling/bug-class/bugClassSchemas';
import { scanCandidates } from '../../../utils/development-tooling/sibling-bug-sweep/scanCandidates';
import type { CandidateContext } from '../../../utils/development-tooling/sibling-bug-sweep/scanCandidates.types';
import {
	attackSurfacePath,
	maxSecurityCandidates,
	securityClassesPath,
	securityClassesSchema
} from './securityReviewSchemas';
import type { SecurityScanReport } from './securityReviewSchemas.types';
import type { SecurityReviewBudget } from './securityReviewBudget';
import type { SecurityScanInput } from './scanSecurityClass.types';

export async function scanSecurityClass(input: SecurityScanInput, budget: SecurityReviewBudget) {
	bugClassId.parse(input.classId);
	if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > maxSecurityCandidates)
		fail(`Security scan limit must be from 1 through ${maxSecurityCandidates}.`);
	budget.checkTime();
	const tree = await CommitTreeAdapter.open(input.root, input.revision, budget.signal);
	const registry = await readDescription(tree, securityClassesPath, 256_000);
	const { classes } = securityClassesSchema.parse(JSON.parse(registry));
	const bugClass = classes.find(({ id }) => id === input.classId);
	if (!bugClass) fail(`Security bug class "${input.classId}" is missing at ${tree.revision}.`);
	const attackSurface = await readDescription(tree, attackSurfacePath, 16_000);
	const scan = await scanCandidates(tree, bugClass, {
		root: input.root,
		reviewLimit: input.limit,
		signal: budget.signal,
		checkDeadline: () => budget.checkTime()
	});
	budget.checkTime();
	const contexts = scan.candidates.slice(0, input.limit);
	const report: SecurityScanReport = {
		schemaVersion: 1,
		kind: 'security-scan',
		revision: tree.revision,
		classId: bugClass.id,
		budget: budget.summary(),
		limit: input.limit,
		scannedFiles: scan.scannedFiles,
		skipped: scan.skipped,
		totalCandidates: scan.candidates.length,
		candidates: contexts.map(publicSite)
	};
	return { report, contexts, bugClass, attackSurface };
}

function publicSite({ source: _source, fromLine: _fromLine, ...site }: CandidateContext) {
	return site;
}

async function readDescription(tree: CommitTreeAdapter, path: string, maxBytes: number) {
	const text = await tree.read(path).catch((error) => {
		if (error instanceof CommitFileNotFoundError)
			fail(`Commit ${path} first. Run harness loop security init for starter files.`);
		throw error;
	});
	if (!text.trim() || Buffer.byteLength(text) > maxBytes)
		fail(`${path} must be nonempty and at most ${maxBytes} bytes.`);
	return text;
}
