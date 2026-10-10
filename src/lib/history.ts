/**
 * Public history contracts of Harness: how records, evidence and reasons are kept in Git and
 * what the portable history index contains. Importing this module has no side effects and
 * needs neither Git nor the CLI.
 */
export {
	evidenceBranch,
	evidenceFileSchema,
	evidenceManifestSchema,
	evidenceMarker,
	evidencePointerSchema,
	evidenceRef,
	historyNoteSchema,
	legacyRecordSchema,
	notesRef,
	sourceArchivePrefix
} from '../core/historyTypes';
export type {
	EvidenceFile,
	EvidenceManifest,
	EvidencePointer,
	HistoryNote,
	LegacyRecord
} from '../core/historyTypes';
export {
	benchmarkSeriesSchema,
	historyIndexSchema,
	indexedRecordSchema,
	indexedRevisionSchema,
	legacyEntrySchema,
	legacyMediaSchema
} from '../core/historyIndexTypes';
export type {
	BenchmarkSeries,
	HistoryIndex,
	IndexedRecord,
	IndexedRevision,
	LegacyEntry,
	LegacyMedia
} from '../core/historyIndexTypes';
export { lfsPointer, lfsStored, parseLfsPointer } from '../utils/lfsPointer';
export type { LfsObject } from '../utils/lfsPointer';
export { mergeNoteLines, noteCommit, noteLine, readNoteLines } from '../utils/noteLines';
export type { ReadNote } from '../utils/noteLines';
export { refKind, sourceArchiveRef } from '../utils/historyRefs';
export type { RefKind } from '../utils/historyRefs';
export { recordLineage } from '../utils/recordLineage';
export type { LineageSource } from '../utils/recordLineage';
export { pushedRefs } from '../utils/pushedRefs';
export type { RecordView, ResolvedMedia } from '../utils/recordView';
export type { RevisionRegistry } from '../utils/revisionRegistry';
