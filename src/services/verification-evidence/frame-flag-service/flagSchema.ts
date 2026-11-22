// @harness-uid u_zhz7hjx43x
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { unitIdPattern } from '../../../core/development-tooling/unitTypes';
import { VerificationRecordValidator } from '../../../validators/verification-evidence/VerificationRecordValidator';
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import type {
	FrameClip,
	FrameClipReference,
	FrameFlag,
	FrameFlagInput,
	FrameVideoFacts
} from '../FrameFlagService.types';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ownerSchema = z.string().regex(unitIdPattern);
export const referenceSchema = z.strictObject({
	record: hash,
	revision: z.string().regex(/^[a-f0-9]{40}$/),
	unit: ownerSchema,
	clipId: ownerSchema,
	viewport: ownerSchema
});
const boundReference = referenceSchema.extend({ sha256: hash, inputHash: hash });
const fraction = z.number().min(0).max(1);
const regionSchema = z
	.strictObject({
		x: fraction,
		y: fraction,
		width: fraction.positive(),
		height: fraction.positive()
	})
	.refine((region) => region.x + region.width <= 1 && region.y + region.height <= 1);
export const inputSchema = z
	.strictObject({
		clip: referenceSchema,
		atSeconds: z.number().nonnegative().optional(),
		frameNumber: z.number().int().nonnegative().optional(),
		region: regionSchema.optional(),
		note: z.string().max(2000).optional(),
		source: z.enum(['human', 'automated']).optional()
	})
	.refine((input) => input.atSeconds !== undefined || input.frameNumber !== undefined);
const clipSchema = boundReference.extend({
	bytes: z.instanceof(Buffer),
	durationSeconds: z.number().positive().max(15),
	frameRate: z.number().positive().max(120),
	width: z.number().int().positive().max(1920),
	height: z.number().int().positive().max(1920),
	capturedAt: z.iso.datetime(),
	addressedFlags: z.array(z.uuid()).refine((ids) => new Set(ids).size === ids.length)
});
export const storedFlagSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: z.uuid(),
	clip: boundReference,
	atSeconds: z.number().nonnegative(),
	frameNumber: z.number().int().nonnegative(),
	region: regionSchema.optional(),
	note: z.string().max(2000),
	source: z.enum(['human', 'automated']),
	createdAt: z.iso.datetime(),
	status: z.literal('active'),
	frame: z.strictObject({
		file: z.literal('frame.png'),
		sha256: hash,
		bytes: z
			.number()
			.int()
			.positive()
			.max(8 * 1024 * 1024),
		mediaType: z.literal('image/png')
	})
});
export const resolutionSchema = z.strictObject({
	schemaVersion: z.literal(1),
	flag: z.uuid(),
	replacement: boundReference,
	addressedFlags: z
		.array(z.uuid())
		.min(1)
		.refine((ids) => new Set(ids).size === ids.length)
});
export const currentSchema = z.array(
	z.strictObject({ clipId: ownerSchema, viewport: ownerSchema, sha256: hash })
);

function parseUncheckedFlagValue<T>(schema: z.ZodType<T>, value: unknown): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success)
		throw new ExpectedCliError(`Invalid frame feedback: ${parsed.error.message}`);
	return parsed.data;
}

/** Revalidate typed callers too: JavaScript and injected readers remain untrusted at runtime. */
export function parseFlagValue<T>(schema: z.ZodType<T>, value: T): T {
	return parseUncheckedFlagValue(schema, value);
}

/** Unknown JSON stays inside the parser until the supplied schema has accepted it. */
export function parseFlagJson<T>(schema: z.ZodType<T>, bytes: Buffer | undefined): T {
	let value: unknown;
	try {
		if (!bytes) throw new ExpectedCliError('missing metadata');
		value = JSON.parse(bytes.toString('utf8')) as unknown;
	} catch {
		throw new ExpectedCliError('Corrupt or missing frame feedback evidence metadata.');
	}
	return parseUncheckedFlagValue(schema, value);
}

export function frameHash(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function boundClip(reference: FrameClipReference, value: FrameClip): FrameClip {
	const clip = parseFlagValue(clipSchema, value);
	for (const key of ['record', 'revision', 'unit', 'clipId', 'viewport'] as const) {
		if (clip[key] !== reference[key])
			throw new ExpectedCliError(
				`Attached clip ${key} does not match the requested owner/reference.`
			);
	}
	if (clip.bytes.length > 8 * 1024 * 1024 || frameHash(clip.bytes) !== clip.sha256)
		throw new ExpectedCliError('Attached clip hash/integrity or byte limit failed.');
	return { ...clip, bytes: Buffer.from(clip.bytes) };
}

export function framePosition(input: FrameFlagInput, facts: FrameVideoFacts) {
	const fromTime =
		input.atSeconds === undefined ? undefined : Math.floor(input.atSeconds * facts.frameRate);
	const frameNumber = input.frameNumber ?? fromTime!;
	if (fromTime !== undefined && fromTime !== frameNumber)
		throw new ExpectedCliError('Timestamp and frame number disagree.');
	if (input.atSeconds !== undefined && input.atSeconds >= facts.durationSeconds)
		throw new ExpectedCliError('Timestamp is outside the retained clip.');
	if (!validFrameIndex(frameNumber, facts.frameCount))
		throw new ExpectedCliError('Frame number is outside the retained clip.');
	const atSeconds = frameNumber / facts.frameRate;
	if (atSeconds >= facts.durationSeconds)
		throw new ExpectedCliError('Frame timestamp is outside the retained clip.');
	return { frameNumber, atSeconds };
}

function validFrameIndex(frame: number, count: number): boolean {
	return Number.isSafeInteger(frame) && frame >= 0 && frame < count;
}

export function sameFrameSlot(left: FrameClipReference, right: FrameClipReference): boolean {
	return (
		left.unit === right.unit && left.clipId === right.clipId && left.viewport === right.viewport
	);
}

export function addressedFlags(clip: FrameClip, flags: FrameFlag[]): FrameFlag[] {
	const addressed = clip.addressedFlags.map((id) => {
		const flag = flags.find((item) => item.id === id);
		if (!flag || !sameFrameSlot(flag.clip, clip) || flag.clip.record === clip.record)
			throw new ExpectedCliError(`Replacement addresses unknown or wrong-owner flag ${id}.`);
		if (Date.parse(clip.capturedAt) <= Date.parse(flag.createdAt))
			throw new ExpectedCliError('Replacement recording must be newer than its frame flag.');
		return flag;
	});
	const pending = flags.filter(
		(flag) => sameFrameSlot(flag.clip, clip) && flag.status !== 'resolved'
	);
	if (pending.some((flag) => !clip.addressedFlags.includes(flag.id)))
		throw new ExpectedCliError('Replacement must explicitly address every pending flag.');
	return addressed;
}

export function owningFrameCapture(
	record: VerificationRecord,
	reference: FrameClipReference
): Capture {
	const { errors } = new VerificationRecordValidator().validate(record);
	if (errors.length) throw new ExpectedCliError(`Invalid attached record: ${errors.join('; ')}`);
	if (!record.components.some((component) => component.unit === reference.unit))
		throw new ExpectedCliError('Attached record did not verify the requested clip owner.');
	const captures = record.scenarios
		.filter(
			(scenario) => scenario.status === 'passed' && scenario.testedRevision === reference.revision
		)
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter((capture) => matchesCapture(capture, reference));
	if (captures.length !== 1)
		throw new ExpectedCliError('Attached record has no unique owning clip.');
	const capture = captures[0];
	if (
		capture.server?.revision !== reference.revision ||
		!record.builds?.some((build) => build.buildId === capture.server?.buildId)
	)
		throw new ExpectedCliError('Attached video source/build stamp does not match its record.');
	return capture;
}

function matchesCapture(capture: Capture, reference: FrameClipReference): boolean {
	return (
		capture.kind === 'video' &&
		capture.status === 'passed' &&
		capture.mediaType === 'video/mp4' &&
		capture.viewport === reference.viewport &&
		capture.video?.unit === reference.unit &&
		capture.video.clipId === reference.clipId
	);
}
