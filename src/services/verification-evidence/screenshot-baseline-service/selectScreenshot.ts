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
	if (captures.length !== 1) return fail('Baseline screenshot is missing or ambiguous.');
	const capture = captures[0];
	const caseStatus = completedCase(input, contract, record, capture);
	assertCapture(input, contract, record, capture);
	const bytes = files.get(capture.path);
	if (!bytes) return fail('Baseline screenshot bytes do not match their recorded hash.');
	if (bytes.length !== capture.bytes || digest(bytes) !== capture.sha256)
		return fail('Baseline screenshot bytes do not match their recorded hash.');
	assertDimensions(bytes, capture, contract);
	return { record, capture, caseStatus, contract, bytes };
}

function completedCase(
	input: ScreenshotReviewInput,
	contract: ScreenshotContract,
	record: VerificationRecord,
	capture: Capture
): 'passed' | 'failed' {
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
	const last = attempts.sort((a, b) => b.retry - a.retry)[0];
	if (last?.status !== 'passed' && last?.status !== 'failed')
		return fail('Baseline case did not execute.');
	return last.status;
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
	let note: unknown;
	try {
		note = JSON.parse(capture.note ?? 'null');
	} catch {
		fail('Baseline screenshot has no valid case binding.');
	}
	if (!matchingBinding(note, input, capture.sha256))
		fail('Baseline screenshot has no valid case binding.');
}

function matchingBinding(value: unknown, input: ScreenshotReviewInput, sha256: string): boolean {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const note = value as Record<string, unknown>;
	return (
		Object.keys(note).sort().join(',') === 'case,revision,sha256,unit' &&
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
