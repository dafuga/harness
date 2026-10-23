import type { z } from 'zod';
import type {
	evidencePointerSchema,
	historyNoteSchema,
	evidenceFileSchema,
	evidenceManifestSchema,
	legacyRecordSchema
} from './historyTypes';

export type EvidencePointer = z.infer<typeof evidencePointerSchema>;

export type HistoryNote = z.infer<typeof historyNoteSchema>;

export type EvidenceFile = z.infer<typeof evidenceFileSchema>;

export type EvidenceManifest = z.infer<typeof evidenceManifestSchema>;

export type LegacyRecord = z.infer<typeof legacyRecordSchema>;
