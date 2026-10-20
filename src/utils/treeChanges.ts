export interface TreeChange {
	path: string;
	status: 'added' | 'modified' | 'removed';
}

export { treeChanges } from '../services/impact-service/treeChanges';
