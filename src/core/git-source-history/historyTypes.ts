import { z } from 'zod';
import { explanationSchema } from '../development-tooling/explanationTypes';

export const evidenceBranch = 'harness-evidence';
export const evidenceRef = `refs/heads/${evidenceBranch}`;
export const notesRef = 'refs/notes/harness';
/** One ref per tested commit, named by its hash, so the commit outlives its branch. */
export const sourceArchivePrefix = 'refs/harness/source/';
/** Where fetched copies of a remote's evidence and notes are kept before they are merged. */
export const remoteTrackingPrefix = 'refs/harness/remotes/';
/** Marker at the root of every evidence tree; a commit that carries it is never source. */
export const evidenceMarker = 'harness-evidence.json';
export const recordsDirectory = 'records';
export const legacyDirectory = 'legacy';

const text = z.string().min(1);
const commit = z.string().regex(/^[0-9a-f]{40}$/, 'must be a full commit hash');
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'must be a sha256 hex digest');
const version = z.literal(1);

/** Where one stored record lives: the evidence commit, its directory and its manifest hash. */
export const evidencePointerSchema = z.strictObject({ commit, path: text, manifest: sha256 });

/**
 * One line of the note on a source commit. Every line names the commit it was written for, so
 * a note copied to another commit proves nothing about that commit.
 */
export const historyNoteSchema = z.discriminatedUnion('kind', [
	z.strictObject({
		schemaVersion: version,
		kind: z.literal('verification'),
		record: text,
		status: z.enum(['passed', 'failed']),
		profile: text,
		finishedAt: text,
		source: z.strictObject({ commit, tree: commit, base: commit.nullable() }),
		evidence: evidencePointerSchema
	}),
	z.strictObject({
		schemaVersion: version,
		kind: z.literal('reason'),
		commit,
		explanation: explanationSchema
	}),
	z.strictObject({
		schemaVersion: version,
		kind: z.literal('legacy-report'),
		commit,
		id: text,
		status: text,
		startedAt: text,
		evidence: evidencePointerSchema
	}),
	z.strictObject({
		schemaVersion: version,
		kind: z.literal('regression'),
		commit,
		loop: text,
		phase: z.enum(['red', 'green']),
		record: sha256,
		evidence: evidencePointerSchema
	})
]);

/** One file of a stored record, with the hash and size of its original bytes. */
export const evidenceFileSchema = z.strictObject({
	path: text,
	sha256,
	bytes: z.number().int().nonnegative(),
	/** `lfs` files are Git LFS pointers on the branch; `git` files are ordinary blobs. */
	storage: z.enum(['git', 'lfs']),
	mediaType: z.string().optional()
});

/** The immutable manifest beside a stored record: every file it consists of. */
export const evidenceManifestSchema = z.strictObject({
	schemaVersion: version,
	record: text,
	source: z.strictObject({ commit, tree: commit }),
	status: z.enum(['passed', 'failed']),
	files: z.array(evidenceFileSchema)
});

/**
 * A report from before Git-backed records, stored as it was recorded: its own id, dates,
 * outcome and revision. Local paths, commands and logs of the old store are not carried over.
 */
export const legacyRecordSchema = z.strictObject({
	schemaVersion: version,
	kind: z.literal('legacy-report'),
	id: text,
	project: z.string(),
	title: z.string(),
	mode: z.string(),
	environment: z.string(),
	status: text,
	state: z.string(),
	startedAt: text,
	updatedAt: text,
	revision: z.string().nullable(),
	summary: z.string(),
	checks: z.array(z.strictObject({ id: text, title: z.string(), status: text })),
	media: z.array(
		z.strictObject({
			id: text,
			title: z.string(),
			file: text,
			status: text,
			mediaType: z.string().optional(),
			capturedAt: z.string().optional(),
			viewport: z.string().optional(),
			provenance: z.literal('legacy-report'),
			/** Null when the old store no longer had the file; the gap is kept, not hidden. */
			sha256: sha256.nullable(),
			bytes: z.number().int().nonnegative().nullable()
		})
	)
});

export type EvidencePointer = z.infer<typeof evidencePointerSchema>;
export type HistoryNote = z.infer<typeof historyNoteSchema>;
export type EvidenceFile = z.infer<typeof evidenceFileSchema>;
export type EvidenceManifest = z.infer<typeof evidenceManifestSchema>;
export type LegacyRecord = z.infer<typeof legacyRecordSchema>;
