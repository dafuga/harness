// @harness-uid u_o2djhpwgs7
import { z } from 'zod';
import { videoBindings } from './video-clip-schema/videoBindings';
import type { VideoManifest, VideoDeclaration } from './videoClipSchema.types';

const id = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const text = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const relativePath = text.refine(
	(path) =>
		!path.startsWith('/') &&
		!path.includes('\\') &&
		!path.includes(':') &&
		![...path].some((char) => char.charCodeAt(0) < 32) &&
		path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
	'must be a safe relative path'
);
const unique = <T extends { id: string }>(items: T[]) =>
	new Set(items.map((item) => item.id)).size === items.length;
const ids = z
	.array(id)
	.refine((items) => new Set(items).size === items.length, 'identifiers must be unique');

const viewport = z.strictObject({
	id,
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	scale: z.number().positive().optional()
});
const clip = z.strictObject({
	id,
	unit: id,
	state: id,
	viewports: ids.min(1),
	inputs: z.array(relativePath).min(1),
	script: z.strictObject({ path: relativePath, export: text }),
	fixture: relativePath,
	entry: id,
	exit: id,
	states: ids.min(1),
	edges: ids,
	durationSeconds: z.number().positive().max(15)
});
const graph = z.strictObject({
	id,
	unit: id,
	initial: id,
	terminals: ids,
	states: z
		.array(z.strictObject({ id, predicate: text }))
		.min(1)
		.refine(unique, 'state ids must be unique'),
	edges: z
		.array(z.strictObject({ id, from: id, to: id, action: text, guard: text.optional() }))
		.refine(unique, 'edge ids must be unique'),
	clips: ids
});

/** Raw shape remains separate so inferred types never depend on their own refinements. */
export const videoManifestBaseSchema = z.strictObject({
	schemaVersion: z.literal(1),
	viewports: z.array(viewport).min(1).refine(unique, 'viewport ids must be unique'),
	clips: z.array(clip).refine(unique, 'clip ids must be unique'),
	graphs: z.array(graph).refine(unique, 'graph ids must be unique'),
	playlists: z
		.array(z.strictObject({ id, clips: ids }))
		.refine(unique, 'playlist ids must be unique')
});
export const videoManifestSchema = videoManifestBaseSchema.superRefine(videoBindings);

const visit = z.strictObject({ id, atSeconds: z.number().nonnegative() });
export const videoCaptureSchema = z.strictObject({
	schemaVersion: z.literal(1),
	clipId: id,
	unit: id,
	inputHash: hash,
	entry: id,
	exit: id,
	entrySignature: hash.optional(),
	exitSignature: hash.optional(),
	states: z.array(visit).min(1),
	edges: z.array(visit),
	profile: z.literal('normal'),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	frameRate: z.number().positive().max(120),
	sourceFrameRate: z.number().positive().max(120),
	frameCount: z.number().int().positive().max(2400),
	poster: z.strictObject({
		file: text.regex(/^[\w.-]+$/).refine((file) => file !== '.' && file !== '..'),
		sha256: hash,
		bytes: z.number().int().positive(),
		timeSeconds: z.number().nonnegative()
	}),
	addressedFlags: z.array(text).optional()
});

/** Validate a finite video library without importing or executing its recording scripts. */
export function videoClipSchema(value: VideoDeclaration): VideoManifest {
	return videoManifestSchema.parse(value);
}
