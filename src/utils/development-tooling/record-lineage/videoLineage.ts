// @harness-uid u_mqlnjtpu6l
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import type { LineageSource, Soundness, VideoOriginRecord } from '../recordLineage.types';
import { canonicalJson } from '../canonicalJson';

/** A successful focused parent proves its own clips, while retaining its partial whole-record verdict. */
export function videoRecordPassed(record: VideoOriginRecord, unit: string): boolean {
	if (!successfulTests(record)) return false;
	if (
		!record.components.some(
			(component) => component.unit === unit && component.change !== 'removed'
		)
	)
		return false;
	if (record.status === 'passed' && record.failures.length === 0) return true;
	// The report carries the same scope marker for each scenario it ran.
	const scope = `Scoped to ${unit}: only its scenario states ran, so this record is partial and never a full pass.`;
	return (
		record.failures.length > 0 &&
		record.failures.every((failure) => failure === scope) &&
		record.tests.length > 0 &&
		record.tests.every((test) => test.status === 'passed') &&
		record.scenarios.length > 0 &&
		record.scenarios.every((scenario) => scenario.status === 'passed')
	);
}

function successfulTests(record: VideoOriginRecord): boolean {
	return record.tests.length > 0 && record.tests.every((test) => test.status === 'passed');
}

/** Every capture field remains original; only reference bookkeeping changes between parents. */
export function sameVideoCapture(left: Capture, right: Capture): boolean {
	const { videoReference: _left, ...a } = left,
		{ videoReference: _right, ...b } = right;
	void _left;
	void _right;
	return canonicalJson(a) === canonicalJson(b);
}

export function originalVideoCapture(
	record: VideoOriginRecord,
	capture: Capture
): Capture | undefined {
	const found = record.scenarios
		.filter(
			(scenario) => scenario.status === 'passed' && scenario.testedRevision === record.source.commit
		)
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter(
			(item) =>
				item.kind === 'video' &&
				item.video?.unit === capture.video?.unit &&
				item.video?.clipId === capture.video?.clipId &&
				item.viewport === capture.viewport &&
				item.state === capture.state
		);
	if (found.length !== 1 || !originalBuildBound(record, found[0])) return undefined;
	return found[0];
}

function originalBuildBound(record: VideoOriginRecord, capture: Capture): boolean {
	return (
		capture.server?.revision === record.source.commit &&
		record.builds?.some((build) => build.buildId === capture.server?.buildId) === true
	);
}

export function videoLineage(
	record: VerificationRecord,
	source: LineageSource,
	sound: Soundness
): string[] {
	return record.scenarios
		.filter((scenario) => scenario.status !== 'referenced')
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter((capture) => capture.videoReference?.record)
		.flatMap((capture) => clipProblems(capture, source, sound));
}

function clipProblems(capture: Capture, source: LineageSource, sound: Soundness): string[] {
	const reference = capture.videoReference!,
		found = source.find(reference.record!);
	const subject = `video clip ${capture.path} original record ${reference.record!.slice(0, 12)}`;
	if (!found) return [`${subject} is not available`];
	if (found.source.commit !== reference.revision || capture.server?.revision !== reference.revision)
		return [`${subject} does not match the original source revision`];
	if (!capture.video || !videoRecordPassed(found, capture.video.unit))
		return [`${subject} did not pass for its owner`];
	const original = originalVideoCapture(found, capture);
	if (!original || !sameVideoCapture(original, capture))
		return [`${subject} differs from its original capture`];
	const problem = clipSoundness(source, found, sound);
	return problem ? [`${subject} is not sound: ${problem}`] : [];
}

function clipSoundness(
	source: LineageSource,
	found: VerificationRecord,
	sound: Soundness
): string | undefined {
	return source.clipProblems ? source.clipProblems(found)[0] : sound(found);
}
