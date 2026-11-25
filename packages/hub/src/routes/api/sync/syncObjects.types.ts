import type { RecordHeader } from './syncEnvelope.types';

export interface ObjectRow {
	object_id: string;
	revision: number;
	size: number;
	r2_key: string | null;
	envelope: string | null;
	change: number;
}

export interface ObjectWrite {
	scope: string;
	id: string;
	header: RecordHeader & { revision: number };
	text: string;
}

export interface Upsert {
	scope: string;
	id: string;
	revision: number;
	size: number;
	key: string | null;
	text: string | null;
}
