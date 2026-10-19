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
export { lfsPointer, lfsStored } from '../utils/lfsPointer';
export { parseLfsPointer } from '../services/attached-record-service/lfsPointer';
export type { LfsObject } from '../utils/lfsPointer';
export { mergeNoteLines, noteLine } from '../repositories/history-note-repository/noteLines';
export { noteCommit, readNoteLines } from '../utils/note-lines/noteCommit';
export { type ReadNote } from '../utils/note-lines/noteCommit';
export { refKind, sourceArchiveRef } from '../utils/historyRefs';
export type { RefKind } from '../utils/historyRefs';
export { recordLineage } from '../utils/recordLineage';
export type { LineageSource } from '../utils/recordLineage';
export { pushedRefs } from '../services/hook-run-service/pushedRefs';
export type { RecordView, ResolvedMedia } from '../utils/recordView';
export { type RevisionRegistry } from '../utils/revision-registry/revisionRegistry';
export { regressionRecordSchema, regressionViewSchema } from '../core/regressionTypes';
export type { RegressionRecord, RegressionPoint, RegressionView } from '../core/regressionTypes';
