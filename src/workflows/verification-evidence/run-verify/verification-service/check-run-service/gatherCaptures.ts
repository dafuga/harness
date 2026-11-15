// @harness-uid u_3exag5gqwq
import type {
	GatherResult,
	Gathered
} from '../../../../../utils/verification-evidence/gatherCaptures';
import { existsSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	captureIndex,
	captureLineSchema,
	type CaptureLine
} from '../../../../../core/verification-evidence/verifyTypes';
import type { Capture } from '../../../../../core/verification-evidence/verificationTypes';
import type { CaptureLimits } from './captureLimits.types';
import { digestFile, oversizeCapture, RecordBudget } from './captureLimits';
import { evidenceDirectoryFailure } from './evidenceDirectoryFailure';
import { mediaFacts } from './mediaFacts';
import { posterBudget, inspectVideoPoster } from './videoPoster';
import { type MediaFacts } from '../../../../../utils/verification-evidence/mediaFacts';

const hex = /^[0-9a-f]{40}$/;

/**
 * Reads what one check wrote to its evidence directory and inspects every file it names. A file
 * over `maxCaptureBytes` is reported and never read. Media and benchmarks are decoded, so they
 * are loaded whole; every other kind is hashed in chunks and never held in memory.
 */
export function gatherCaptures(
	directory: string,
	recordPath: string,
	limits: CaptureLimits = {},
	scope: { budget?: RecordBudget; root?: string } = {}
): GatherResult {
	const budget = scope.budget ?? new RecordBudget(limits.maxRecordBytes);
	const refusal = evidenceDirectoryFailure(directory, scope.root ?? directory);
	if (refusal) return { gathered: [], failures: [refusal] };
	const index = join(directory, captureIndex);
	const result: GatherResult = { gathered: [], failures: [] };
	const lines = indexLines(index, result);
	for (const text of lines) {
		const item = gatherLine(text, directory, { recordPath, limits, budget });
		if (typeof item === 'string') result.failures.push(item);
		else result.gathered.push(item);
	}
	return result;
}

export function gatherLine(
	text: string,
	directory: string,
	scope: { recordPath: string; limits: CaptureLimits; budget: RecordBudget }
): Gathered | string {
	const parsed = captureLineSchema.safeParse(parseJson(text));
	if (!parsed.success) return 'wrote a malformed capture line';
	const file = join(directory, parsed.data.file);
	if (!existsSync(file)) return `declared capture ${parsed.data.file} but wrote no file`;
	try {
		return inspectBudgeted(parsed.data, file, scope);
	} catch (error) {
		return `could not inspect capture ${parsed.data.file}: ${error instanceof Error ? error.message : 'read failed'}`;
	}
}

function inspectBudgeted(
	line: CaptureLine,
	file: string,
	{
		recordPath,
		limits,
		budget
	}: { recordPath: string; limits: CaptureLimits; budget: RecordBudget }
): Gathered | string {
	const stat = lstatSync(file);
	if (!stat.isFile()) throw new Error('Capture must be a regular file, not a symlink.');
	checkVideoBytes(line, stat.size);
	const refused =
		oversizeCapture(line.file, stat.size, limits) ??
		budget.refusal(`${recordPath}/${line.file}`, stat.size);
	if (refused) return refused;
	const cap = Math.min(limits.maxCaptureBytes ?? Infinity, budget.remaining() ?? Infinity);
	const posterBytes =
		line.kind === 'video' ? posterBudget(line, file, { budget, limits, videoBytes: stat.size }) : 0;
	const item = inspect(line, file, recordPath, {
		maxCaptureBytes: Number.isFinite(cap) ? cap : undefined
	});
	if (line.kind === 'video') inspectVideoPoster(line, file, item.facts);
	budget.retain(item.capture.bytes + posterBytes);
	return item;
}

function inspect(
	line: CaptureLine,
	source: string,
	recordPath: string,
	limits: CaptureLimits
): Gathered {
	const { sha256, bytes, facts, benchmark } = load(line, source, limits);
	const { file, server, durationSeconds, ...rest } = line;
	const duration = actualDuration(facts) ?? durationSeconds;
	const capture: Capture = {
		...rest,
		status: 'passed',
		path: `${recordPath}/${file}`,
		sha256,
		bytes,
		capturedAt: new Date().toISOString(),
		...(duration === undefined ? {} : { durationSeconds: duration }),
		...(server && hex.test(server.revision) ? { server } : {})
	};
	return { line, capture, facts, benchmark };
}

/** Media and benchmarks are decoded or parsed, so they are read whole; the rest only streamed. */
function load(
	line: CaptureLine,
	source: string,
	limits: CaptureLimits
): { sha256: string; bytes: number; facts?: MediaFacts; benchmark?: unknown } {
	const media = ['screenshot', 'audio', 'video'].includes(line.kind);
	if (!media && line.kind !== 'benchmark') return digestFile(source, limits.maxCaptureBytes);
	const { contents: decoded, ...digest } = digestFile(source, limits.maxCaptureBytes, true);
	if (!decoded) throw new Error('Capture bytes were not read.');
	return {
		...digest,
		facts: media ? mediaFacts(decoded, line.mediaType) : undefined,
		benchmark: media ? undefined : parseJson(decoded.toString('utf8'))
	};
}

/** The duration the audio really has, which replaces whatever the check declared. */
function actualDuration(facts: MediaFacts | undefined): number | undefined {
	return facts &&
		'kind' in facts &&
		['audio', 'video'].includes(facts.kind) &&
		'durationSeconds' in facts
		? facts.durationSeconds
		: undefined;
}

/**
 * Largest `captures.ndjson` one check may leave. Fixed, not read from `harness.verify.json`: an
 * index over it is refused whole, never truncated, and none of the captures it names are read.
 */
const maxCaptureIndexBytes = 2_000_000;

export function indexLines(path: string, result: GatherResult): string[] {
	if (!existsSync(path)) return [];
	try {
		if (!lstatSync(dirname(path)).isDirectory())
			throw new Error('Capture directory must be a regular directory.');
		const index = lstatSync(path);
		if (!index.isFile()) throw new Error('Capture index must be a regular file.');
		if (index.size > maxCaptureIndexBytes) {
			// Said on its own, with the file and both sizes, so the cap is never hit silently.
			result.failures.push(
				`left capture index ${captureIndex} of ${index.size} bytes, over the fixed capture index ` +
					`cap of ${maxCaptureIndexBytes} bytes; none of the captures it names were recorded`
			);
			return [];
		}
		const { contents } = digestFile(path, maxCaptureIndexBytes, true);
		return contents ? contents.toString('utf8').split('\n').filter(Boolean) : [];
	} catch {
		result.failures.push(
			`capture directory must be a regular directory; capture index must be a regular file of at most ${maxCaptureIndexBytes} bytes`
		);
		return [];
	}
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

function checkVideoBytes(line: CaptureLine, bytes: number): void {
	if (line.kind === 'video' && bytes > 8 * 1024 * 1024)
		throw new Error('Video exceeds the fixed 8 MiB clip cap.');
}

export { gatherVerificationCaptures } from './gatherVideoReferences';
