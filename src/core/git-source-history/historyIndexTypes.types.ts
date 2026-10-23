import type { z } from 'zod';
import type {
	indexedRecordSchema,
	indexedRevisionSchema,
	benchmarkSeriesSchema,
	legacyEntrySchema,
	legacyMediaSchema,
	historyIndexSchema
} from './historyIndexTypes';

export type IndexedRecord = z.infer<typeof indexedRecordSchema>;

export type IndexedRevision = z.infer<typeof indexedRevisionSchema>;

export type BenchmarkSeries = z.infer<typeof benchmarkSeriesSchema>;

export type LegacyEntry = z.infer<typeof legacyEntrySchema>;

export type LegacyMedia = z.infer<typeof legacyMediaSchema>;

export type HistoryIndex = z.infer<typeof historyIndexSchema>;
