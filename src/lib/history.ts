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
} from '../core/git-source-history/historyTypes';
export type {
	EvidenceFile,
	EvidenceManifest,
	EvidencePointer,
	HistoryNote,
	LegacyRecord
} from '../core/git-source-history/historyTypes';
export {
	benchmarkSeriesSchema,
	historyIndexSchema,
	indexedRecordSchema,
	indexedRevisionSchema,
	legacyEntrySchema,
	legacyMediaSchema
} from '../core/git-source-history/historyIndexTypes';
export type {
	BenchmarkSeries,
	HistoryIndex,
	IndexedRecord,
	IndexedRevision,
	LegacyEntry,
	LegacyMedia
} from '../core/git-source-history/historyIndexTypes';
export { lfsPointer, lfsStored } from '../utils/verification-evidence/lfsPointer';
export { parseLfsPointer } from '../services/verification-evidence/history-status-service/attached-record-service/lfsPointer';
export type { LfsObject } from '../utils/verification-evidence/lfsPointer';
export {
	mergeNoteLines,
	noteLine
} from '../repositories/git-source-history/history-note-repository/noteLines';
export { noteCommit, readNoteLines } from '../utils/git-source-history/note-lines/noteCommit';
export { type ReadNote } from '../utils/git-source-history/note-lines/noteCommit';
export { refKind, sourceArchiveRef } from '../utils/git-source-history/historyRefs';
export type { RefKind } from '../utils/git-source-history/historyRefs';
export { recordLineage } from '../utils/development-tooling/recordLineage';
export type { LineageSource } from '../utils/development-tooling/recordLineage';
export { pushedRefs } from '../cli/program/hook-run-service/pushedRefs';
export type { RecordView, ResolvedMedia } from '../utils/development-tooling/recordView';
export { type RevisionRegistry } from '../utils/verification-evidence/revision-registry/revisionRegistry';
export {
	regressionRecordSchema,
	regressionViewSchema
} from '../core/verification-evidence/regressionTypes';
export type {
	RegressionRecord,
	RegressionPoint,
	RegressionView
} from '../core/verification-evidence/regressionTypes';
