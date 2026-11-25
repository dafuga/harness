// @harness-uid u_wwerrde2nk
import { createHash } from 'node:crypto';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { BugClass } from '../../../core/development-tooling/bug-class/bugClassSchemas.types';
import type { PatternHit } from './patternHits.types';
import { committedSourcePaths } from './committedSourcePaths';
import { patternHits } from './patternHits';
import type { CandidateContext, SourceRange } from './scanCandidates.types';

const maxSourceLength = 2_000_000;

export async function scanCandidates(
	tree: SourceTree,
	bugClass: BugClass,
	options: {
		root: string;
		ranges?: Map<string, SourceRange[]>;
		origin?: { path: string; line: number };
		reviewLimit: number;
		signal?: AbortSignal;
		checkDeadline?: () => void;
	}
) {
	const files = await committedSourcePaths(
		options.root,
		tree.revision,
		options.ranges,
		options.signal
	);
	const paths = files.filter(({ bytes }) => bytes <= maxSourceLength).map(({ path }) => path);
	const candidates: CandidateContext[] = [];
	const skipped = files.filter(({ bytes }) => bytes > maxSourceLength).map(({ path }) => path);
	let scannedFiles = 0;
	for (let index = 0; index < paths.length; index += 24) {
		options.signal?.throwIfAborted();
		const batch = paths.slice(index, index + 24);
		const texts = await Promise.all(batch.map((path) => tree.read(path)));
		batch.forEach((path, offset) => {
			options.checkDeadline?.();
			const source = texts[offset];
			if (source.includes('\0')) skipped.push(path);
			else {
				scannedFiles++;
				for (const candidate of fileCandidates(path, source, bugClass, options.ranges?.get(path)))
					candidates.push(candidate);
			}
		});
	}
	return {
		scannedFiles,
		skipped,
		candidates: rankCandidates(
			candidates.filter((site) => !isOrigin(site, options.origin)),
			options.reviewLimit
		)
	};
}

function fileCandidates(path: string, source: string, bugClass: BugClass, ranges?: SourceRange[]) {
	const hits = patternHits(path, source, bugClass.patterns).sort((a, b) => a.line - b.line);
	if (!hits.length) return [];
	const lines = source.split('\n');
	return hitGroups(hits)
		.filter((group) => intersects(group, ranges))
		.map((group) => {
			const line = group[0].line;
			const lastLine = group.at(-1)!.line;
			const fromLine = Math.max(1, line - 12);
			const excerpt = lines
				.slice(fromLine - 1, lastLine + 12)
				.join('\n')
				.slice(0, 4000);
			const matches = [...new Set(group.map((hit) => hit.pattern))];
			const context = (path + '\n' + excerpt).toLowerCase();
			const relevance = bugClass.contextTerms.filter((term) =>
				context.includes(term.toLowerCase())
			);
			const weights = matches.map((match) => match.weight).sort((a, b) => b - a);
			const pathScore = bugClass.pathHints
				.filter((hint) => path.toLowerCase().includes(hint.contains.toLowerCase()))
				.reduce((sum, hint) => sum + hint.weight, 0);
			const score =
				weights[0] * 2 +
				weights.slice(0, 3).reduce((sum, weight) => sum + weight, 0) +
				relevance.length +
				pathScore;
			const id = createHash('sha256')
				.update(JSON.stringify([path, line]))
				.digest('hex')
				.slice(0, 20);
			return { id, path, line, lastLine, score, matches, fromLine, source: excerpt };
		});
}

function hitGroups(hits: PatternHit[]): PatternHit[][] {
	const groups: PatternHit[][] = [];
	for (const hit of hits) {
		const last = groups.at(-1);
		if (last && hit.line - last[0].line <= 8) last.push(hit);
		else groups.push([hit]);
	}
	return groups;
}

function intersects(group: PatternHit[], ranges?: SourceRange[]) {
	if (!ranges) return true;
	return ranges.some(
		({ start, end }) => group[0].line - 12 <= end && group.at(-1)!.line + 12 >= start
	);
}

function rankCandidates(candidates: CandidateContext[], limit: number) {
	candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line);
	const patterns = new Set(candidates.flatMap((site) => site.matches));
	const selected = new Set<CandidateContext>();
	const files = new Set<string>();
	for (const pattern of [...patterns].sort((a, b) => b.weight - a.weight)) {
		if (selected.size >= limit) break;
		const relevant = candidates.find(
			(site) => !files.has(site.path) && site.matches.includes(pattern)
		);
		if (!relevant) continue;
		selected.add(relevant);
		files.add(relevant.path);
	}
	for (const candidate of candidates) {
		if (selected.size >= limit) break;
		if (files.has(candidate.path)) continue;
		selected.add(candidate);
		files.add(candidate.path);
	}
	return [...selected, ...candidates.filter((site) => !selected.has(site))];
}

function isOrigin(site: CandidateContext, origin?: { path: string; line: number }) {
	return (
		site.path === origin?.path && site.line - 3 <= origin.line && site.lastLine + 3 >= origin.line
	);
}
