import type { SourceTree } from '../core/sourceTypes';

export type HelperTree = Pick<SourceTree, 'read'> & Partial<Pick<SourceTree, 'list'>>;

export interface HelperConsumer {
	unit: string;
	symbol?: string;
}

export { helperConsumers } from '../services/revision-detail-service/helperConsumers';
