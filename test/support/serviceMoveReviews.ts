import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { relocatedSource } from './memoryTree';

interface ReviewedFile {
	from: string;
	to: string;
	definition: string;
	relocationDefinition?: string;
	review?: { commit: string; path: string; definition: string; reason: string };
}
interface Ledger {
	originalProof?: string;
	moves: Record<string, string>;
	files: ReviewedFile[];
}
type Git = (args: string[]) => string;

/**
 * The committed objects the reviews name, exported from real Git objects (see the README beside
 * it). A snapshot of tracked source has no repository, so they are read from this pack alone.
 */
export const reviewHistory = resolve(import.meta.dirname, 'service-review-history/objects.pack');

/** Later behavior remains traceable to committed source and never overwrites the move proof. */
export function serviceMoveReviews(ledger: Ledger, pack = reviewHistory): string[] {
	const reviewed = ledger.files.filter((file) => file.review);
	if (!reviewed.length) return [];
	const gaps: string[] = [];
	const history = mkdtempSync(join(tmpdir(), 'harness-review-history-'));
	try {
		const git = opened(history, pack);
		const original = originalFiles(git, ledger);
		for (const file of reviewed) {
			const review = file.review!;
			const previous = original.find((entry) => entry.from === file.from && entry.to === file.to);
			if (file.relocationDefinition !== previous?.definition)
				gaps.push(`${file.to}: original move proof lost`);
			if (!review.reason.trim() || review.definition !== file.definition)
				gaps.push(`${file.to}: incomplete behavior review`);
			const source = committed(git, review.commit, review.path);
			if (relocatedSource(review.path, ledger.moves, source) !== review.definition)
				gaps.push(`${file.to}: reviewed source does not match its commit`);
		}
	} catch (cause) {
		gaps.push(`Reviewed source unavailable: ${String(cause)}`);
	} finally {
		rmSync(history, { recursive: true, force: true });
	}
	return gaps;
}

/** The files the original move proof recorded, read from its own commit. */
function originalFiles(git: Git, ledger: Ledger): ReviewedFile[] {
	const path = 'specification/loops/shared-service-ownership/migration.json';
	const proof = committed(git, ledger.originalProof ?? '', path);
	return (JSON.parse(proof) as { files: ReviewedFile[] }).files;
}

/**
 * Tampering the reviews must reject: a damaged pack, a real commit the pack does not hold, and
 * another committed path given as a review. Returns the names of those that left a gap.
 */
export function rejectedTampering(ledger: Ledger): string[] {
	const scratch = mkdtempSync(join(tmpdir(), 'harness-review-tamper-'));
	try {
		const bytes = readFileSync(reviewHistory);
		bytes[bytes.length >> 1] ^= 0xff;
		const damaged = join(scratch, 'damaged.pack');
		writeFileSync(damaged, bytes);
		const [first, second] = ledger.files.filter((file) => file.review);
		const altered = (review: Partial<NonNullable<ReviewedFile['review']>>) => ({
			...ledger,
			files: [{ ...first, review: { ...first.review!, ...review } }]
		});
		const probes: Array<[string, string[], string]> = [
			['corrupted pack', serviceMoveReviews(ledger, damaged), 'Reviewed source unavailable'],
			// The main commit that brought these moves: real, but never a review of them.
			[
				'foreign commit',
				serviceMoveReviews(altered({ commit: '54e157c42845945bb1fc1fa4e802d96983f7e584' })),
				'Reviewed source unavailable'
			],
			[
				'other path',
				serviceMoveReviews(altered({ commit: second.review!.commit, path: second.review!.path })),
				'reviewed source does not match its commit'
			]
		];
		return probes
			.filter(([, gaps, said]) => gaps.some((gap) => gap.includes(said)))
			.map(([n]) => n);
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

/** A bare repository of its own holding only the pack; no repository around it is consulted. */
function opened(directory: string, pack: string): Git {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
	);
	const run = (args: string[], input?: Buffer) =>
		execFileSync('git', args, {
			encoding: 'utf8',
			input,
			env,
			stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe']
		});
	run(['init', '--quiet', '--bare', '--object-format=sha1', directory]);
	run(['--git-dir', directory, 'index-pack', '--stdin'], readFileSync(pack));
	return (args) => run(['--git-dir', directory, ...args]);
}

function committed(git: Git, commit: string, path: string): string {
	if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit))
		throw new Error('Review needs a full commit');
	if (git(['rev-parse', '--verify', `${commit}^{commit}`]).trim() !== commit)
		throw new Error('Review does not resolve to its stated commit');
	return git(['show', `${commit}:${path}`]);
}
