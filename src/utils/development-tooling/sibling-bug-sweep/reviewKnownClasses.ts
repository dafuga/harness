// @harness-uid u_wwerrde2nk
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { evaluateAgent } from '../../agents-providers/evaluateAgent';
import type { BugEvaluator, SweepReviewInput } from '../siblingBugSweep.types';
import { readBugClasses } from './recordBugClass';
import { reviewCandidates } from './reviewCandidates';
import { scanCandidates } from './scanCandidates';
import type { SourceRange } from './scanCandidates.types';

export async function reviewKnownClasses(
	input: SweepReviewInput,
	evaluate: BugEvaluator = evaluateAgent
) {
	const git = new GitAdapter(input.root);
	const head = await CommitTreeAdapter.open(input.root, input.revision ?? 'HEAD');
	const namedBase = await CommitTreeAdapter.open(input.root, input.base);
	const mergeBase = await git.run(['merge-base', namedBase.revision, head.revision]);
	const base = await CommitTreeAdapter.open(input.root, mergeBase);
	const classes = await readBugClasses(base);
	const ranges = classes.length
		? await changedRanges(git, base.revision, head.revision)
		: new Map<string, SourceRange[]>();
	const reports = [];
	for (const bugClass of classes) {
		const scan = await scanCandidates(head, bugClass, {
			root: input.root,
			ranges,
			reviewLimit: input.reviewLimit
		});
		const review = await reviewCandidates(scan.candidates, bugClass, evaluate, input);
		reports.push({ bugClass, scannedFiles: scan.scannedFiles, skipped: scan.skipped, ...review });
	}
	return {
		base: base.revision,
		revision: head.revision,
		model: input.model,
		passed: reports.every(
			(report) =>
				!report.errors.length &&
				!report.skipped.length &&
				report.candidates.every(
					(candidate) => !['confirmed', 'not-reviewed'].includes(candidate.verdict)
				)
		),
		reports
	};
}

async function changedRanges(git: GitAdapter, base: string, head: string) {
	const args = ['diff', '--no-ext-diff', '--no-textconv', '--no-renames'];
	const names = (await git.run([...args, '--name-only', '-z', '--diff-filter=AM', base, head]))
		.split('\0')
		.filter(Boolean);
	const ranges = new Map<string, SourceRange[]>();
	for (const path of names) {
		const diff = await git.run([
			'--literal-pathspecs',
			...args,
			'--unified=0',
			base,
			head,
			'--',
			path
		]);
		const lines = [...diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)]
			.map(([, line, length]) => ({
				start: Number(line),
				end: Number(line) + Number(length ?? '1') - 1
			}))
			.filter(({ start, end }) => start <= end);
		if (lines.length) ranges.set(path, lines);
	}
	return ranges;
}
