// @harness-uid u_lhuhmdnkjv
export interface TreeChange {
	path: string;
	status: 'added' | 'modified' | 'removed';
}

export { treeChanges } from '../../services/reports-media/impact-service/treeChanges';
