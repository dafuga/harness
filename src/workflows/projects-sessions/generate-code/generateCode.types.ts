import type { PieceKind } from '../../../templates/development-tooling/pieces';
import type { FileWriteResult } from '../../../core/development-tooling/files';

export interface GenerateModelInput {
	name: string;
	rawFields: string[];
	adapter: string;
	force?: boolean;
	root?: string;
	group?: string;
}

export interface GeneratePieceInput {
	level?: 'molecule' | 'organism';
	kind: PieceKind;
	name: string;
	force?: boolean;
	root?: string;
	group?: string;
	responsibility?: string;
}

export interface GenerateResult {
	kind: string;
	name: string;
	writes: FileWriteResult[];
	exportsUpdated: boolean;
}
