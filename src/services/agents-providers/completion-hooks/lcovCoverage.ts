// @harness-uid u_xghv2ih7cg
import { relative, resolve } from 'node:path';
import type { CoverageMetric, FileCoverage } from './completionRun.types';
import { CompletionCheckError } from './CompletionCheckError';

export function lcovCoverage(text: string, cwd: string, source: string[]) {
	const allowed = new Set(source);
	const coverage: Record<string, FileCoverage> = Object.create(null);
	for (const record of text.split(/^end_of_record\r?$/m)) {
		const file = record.match(/^SF:(.+)$/m)?.[1];
		if (!file) continue;
		const path = relative(cwd, resolve(cwd, file.trim()));
		if (!allowed.has(path)) continue;
		if (coverage[path]) throw new CompletionCheckError('LCOV contains duplicate source records.');
		coverage[path] = {
			lines: lineCoverage(record),
			functions: countCoverage(record, 'FNH', 'FNF'),
			branches: countCoverage(record, 'BRH', 'BRF')
		};
	}
	return coverage;
}

function lineCoverage(record: string): CoverageMetric | undefined {
	// Bun's LF includes source lines without counters. DA enumerates executable lines.
	const counters = new Map<number, number>();
	for (const [, line, count] of record.matchAll(/^DA:(\d+),(\d+)(?:,.*)?\r?$/gm)) {
		if (counters.has(Number(line)))
			throw new CompletionCheckError('LCOV has duplicate line counters.');
		counters.set(Number(line), Number(count));
	}
	return counters.size
		? metric([...counters.values()].filter((count) => count > 0).length, counters.size)
		: countCoverage(record, 'LH', 'LF');
}

function countCoverage(record: string, hitKey: string, totalKey: string) {
	const hit = record.match(new RegExp(`^${hitKey}:(\\d+)\\r?$`, 'm'))?.[1];
	const total = record.match(new RegExp(`^${totalKey}:(\\d+)\\r?$`, 'm'))?.[1];
	if (hit === undefined && total === undefined) return undefined;
	return metric(Number(hit), Number(total));
}

function metric(hit: number, total: number): CoverageMetric | undefined {
	if (![hit, total].every(Number.isSafeInteger) || hit > total)
		throw new CompletionCheckError('LCOV contains invalid coverage counters.');
	if (!total) return undefined;
	return { hit, total, percent: (100 * hit) / total };
}

export function requireNondecreasingCoverage(
	before: Record<string, FileCoverage>,
	after: Record<string, FileCoverage>,
	changedSource: string[]
) {
	if (
		!Object.values(before).some((file) => file.lines) ||
		changedSource.some((path) => !before[path]?.lines)
	)
		throw new CompletionCheckError(
			'No comparable baseline line coverage for the changed module source.'
		);
	for (const [path, baseline] of Object.entries(before)) {
		for (const dimension of ['lines', 'functions', 'branches'] as const) {
			const previous = baseline[dimension];
			const candidate = after[path]?.[dimension];
			if (
				previous &&
				(!candidate || candidate.hit * previous.total < previous.hit * candidate.total)
			)
				throw new CompletionCheckError(`Module ${dimension} coverage fell for ${path}.`);
		}
	}
}
