import { createHash } from 'node:crypto';
import { fail } from '../../../core/development-tooling/errors';
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import { mediaFacts } from '../../../utils/verification-evidence/mediaFacts';
import type {
	ScreenshotCandidate,
	ScreenshotContract,
	ScreenshotReviewInput
} from './ScreenshotBaselineService.types';

/** A screenshot is reviewable only when the declared case actually produced its exact pixels. */
export function selectScreenshot(
	input: ScreenshotReviewInput,
	contract: ScreenshotContract,
	record: VerificationRecord,
	files: Map<string, Buffer>
): ScreenshotCandidate {
	const scenario = record.scenarios.find((entry) => entry.id === input.scenario);
	if (!scenario || scenario.status === 'referenced' || scenario.testedRevision !== input.commit)
		return fail('Baseline capture was not produced at the tested revision.');
	const captures = scenario.states
		.filter((entry) => entry.id === contract.state && entry.coverage === 'required')
		.flatMap((entry) => entry.captures)
		.filter(
			(capture) => capture.evidence === input.evidence && capture.viewport === input.viewport
		);
	const selected = selectAttempt(input, contract, record, captures);
	const { capture } = selected;
	assertCapture(input, contract, record, capture);
	const bytes = files.get(capture.path);
	if (!bytes) return fail('Baseline screenshot bytes do not match their recorded hash.');
	if (bytes.length !== capture.bytes || digest(bytes) !== capture.sha256)
		return fail('Baseline screenshot bytes do not match their recorded hash.');
	assertDimensions(bytes, capture, contract);
	return { record, ...selected, contract, bytes };
}

function selectAttempt(
	input: ScreenshotReviewInput,
	contract: ScreenshotContract,
	record: VerificationRecord,
	captures: Capture[]
) {
	const matches = captures.flatMap((capture) => {
		const retry = captureAttempt(capture, input);
		return retry === undefined ? [] : [{ capture, retry }];
	});
	if (!matches.length && captures.length === 1)
		return fail('Baseline screenshot has no valid case binding.');
	const candidates = matches.map((match) => ({
		...match,
		outcome: completedCase(input, contract, record, match.capture)
	}));
	for (const { retry, outcome } of candidates) assertAttemptBinding(retry, outcome);
	if (new Set(candidates.map(({ retry }) => retry)).size !== candidates.length)
		return fail('Baseline screenshot is missing or ambiguous.');
	const current = candidates.filter(
		({ retry, outcome }) => retry === null || retry === outcome.retry
	);
	if (current.length !== 1) return fail('Baseline screenshot is missing or ambiguous.');
	const { capture, retry, outcome } = current[0];
	return {
		capture,
		caseStatus: outcome.status,
		...(retry === null ? {} : { captureRetry: retry })
	};
}

function assertAttemptBinding(
	retry: number | null,
	outcome: ReturnType<typeof completedCase>
): void {
	if (retry === null && (outcome.attempts.length !== 1 || outcome.retry !== 0))
		fail('Baseline screenshot has no valid attempt binding.');
	const observed = outcome.attempts.find((attempt) => attempt.retry === retry);
	if (retry !== null && (!observed || observed.status === 'skipped'))
		fail('Baseline screenshot references an unexecuted attempt.');
}

function completedCase(
	input: ScreenshotReviewInput,
	contract: ScreenshotContract,
	record: VerificationRecord,
	capture: Capture
) {
	const checks = contract.checks.filter((id) =>
		capture.path.startsWith(`evidence/${input.commit}/${input.scenario}/${id}/`)
	);
	if (checks.length !== 1) return fail('Baseline capture is not owned by its declared check.');
	const check = record.tests.find((item) => item.id === `${input.scenario}:${checks[0]}`);
	const attempts = (check?.cases?.outcomes ?? []).filter(
		(item) =>
			item.file === contract.testFile &&
			item.title === contract.testTitle &&
			item.revision === input.commit
	);
	if (new Set(attempts.map((attempt) => attempt.retry)).size !== attempts.length)
		return fail('Baseline case attempts are ambiguous.');
	const last = attempts.sort((a, b) => b.retry - a.retry)[0];
	if (last?.status !== 'passed' && last?.status !== 'failed')
		return fail('Baseline case did not execute.');
	return { status: last.status, retry: last.retry, attempts };
}

function assertCapture(
	input: ScreenshotReviewInput,
	contract: ScreenshotContract,
	record: VerificationRecord,
	capture: Capture
): void {
	const build = record.builds?.find((item) => item.id === contract.build);
	const valid = [
		capture.kind === 'screenshot',
		capture.mediaType === 'image/png',
		capture.provenance === 'actual-capture',
		capture.server?.revision === input.commit,
		Boolean(build),
		capture.server?.buildId === build?.buildId
	].every(Boolean);
	if (!valid) fail('Baseline screenshot has no matching served build and revision.');
}

function captureAttempt(capture: Capture, input: ScreenshotReviewInput): number | null | undefined {
	const note = parseNote(capture.note);
	if (!note || !matchesNote(note, input, capture.sha256)) return undefined;
	const keys = Object.keys(note).sort().join(',');
	if (keys === 'case,revision,sha256,unit') return null;
	const retry = note.retry;
	if (
		keys !== 'case,retry,revision,sha256,unit' ||
		typeof retry !== 'number' ||
		!Number.isSafeInteger(retry) ||
		retry < 0
	)
		return undefined;
	return retry;
}

function parseNote(value: string | undefined): Record<string, unknown> | undefined {
	try {
		const note: unknown = JSON.parse(value ?? 'null');
		return note && typeof note === 'object' && !Array.isArray(note)
			? (note as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

function matchesNote(
	note: Record<string, unknown>,
	input: ScreenshotReviewInput,
	sha256: string
): boolean {
	return (
		note.unit === input.unit &&
		note.case === input.case &&
		note.revision === input.commit &&
		note.sha256 === sha256
	);
}

function assertDimensions(bytes: Buffer, capture: Capture, contract: ScreenshotContract): void {
	const facts = mediaFacts(bytes, capture.mediaType);
	if ('error' in facts || facts.kind !== 'image') fail('Baseline PNG cannot be decoded.');
	const { width, height, scale } = contract.viewport;
	const clip = capture.clip;
	if (contract.mode === 'element') {
		if (!clip) fail('Baseline PNG does not match its element bounds.');
		const valid = [
			clip.x + clip.width <= width,
			Math.abs(facts.width - clip.width * scale) <= 0.5,
			Math.abs(facts.height - clip.height * scale) <= 0.5
		].every(Boolean);
		if (!valid) fail('Baseline PNG does not match its element bounds.');
		return;
	}
	const tall =
		contract.mode === 'full-page'
			? facts.height >= height * scale
			: facts.height === height * scale;
	if (facts.width !== width * scale || !tall) fail('Baseline PNG does not match its viewport.');
}

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
