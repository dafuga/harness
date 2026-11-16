// @harness-uid u_bmfjvxz4dh
import type { ExplorerArtifact } from '../../../models/explorer-ui/Explorer.types';

export type EntityCasesDocument = ExplorerArtifact['document'];

export type Row = {
	name: string;
	description?: string;
	input: unknown;
	failed: boolean;
	result: unknown;
};
