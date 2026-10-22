import type { IndexedRecord } from '../../core/historyIndexTypes';
export interface CatalogRecordAttributes {
	id: string;
	commit: string;
	status: string;
	valid: boolean;
	data: IndexedRecord;
}
export type CatalogRecordCreateInput = CatalogRecordAttributes;
export type CatalogRecordUpdateInput = Partial<Omit<CatalogRecordAttributes, 'id'>>;
