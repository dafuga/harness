import { execFileSync } from 'node:child_process';
import { relocatedSource } from './memoryTree';
import { dirname } from 'node:path';

interface ReviewedFile {
	from: string;
	to: string;
	definition: string;
	relocationDefinition?: string;
	review?: { commit: string; path: string; definition: string; reason: string };
}

/** Later behavior remains traceable to committed source and never overwrites the move proof. */
export function serviceMoveReviews(ledger: {
	originalProof?: string;
	moves: Record<string, string>;
	files: ReviewedFile[];
}): string[] {
	const reviewed = ledger.files.filter((file) => file.review);
	if (!reviewed.length) return [];
	const gaps: string[] = [];
	try {
		const original = JSON.parse(
			committed(
				ledger.originalProof ?? '',
				'specification/loops/shared-service-ownership/migration.json'
			)
		) as { files: ReviewedFile[] };
		for (const file of reviewed) {
			const review = file.review!;
			const previous = original.files.find(
				(entry) => entry.from === file.from && entry.to === file.to
			);
			if (file.relocationDefinition !== previous?.definition)
				gaps.push(`${file.to}: original move proof lost`);
			if (!review.reason.trim() || review.definition !== file.definition)
				gaps.push(`${file.to}: incomplete behavior review`);
			if (
				relocatedSource(review.path, ledger.moves, committed(review.commit, review.path)) !==
				review.definition
			)
				gaps.push(`${file.to}: reviewed source does not match its commit`);
		}
	} catch (cause) {
		gaps.push(`Reviewed source unavailable: ${String(cause)}`);
	}
	return gaps;
}

function committed(commit: string, path: string): string {
	if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit))
		throw new Error('Review needs a full commit');
	const read = (args: string[]) =>
		execFileSync('git', objectSource(args), {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		});
	if (read(['rev-parse', '--verify', `${commit}^{commit}`]).trim() !== commit)
		throw new Error('Review does not resolve to its stated commit');
	return read(['show', `${commit}:${path}`]);
}

/** These two immutable-object reads need no checkout, index, source files or writable ref. */
function objectSource(args: string[]): string[] {
	const objects = process.env.HARNESS_VERIFY_GIT_OBJECTS;
	return objects ? ['--git-dir', dirname(objects), ...args] : args;
}
