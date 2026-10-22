import type { SourceTree } from '../../core/development-tooling/sourceTypes';

export type HelperTree = Pick<SourceTree, 'read'> & Partial<Pick<SourceTree, 'list'>>;

export interface HelperConsumer {
	unit: string;
	symbol?: string;
}

export { helperConsumers } from '../../services/explorer-ui/revision-detail-service/helperConsumers';
