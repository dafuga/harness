import type { PieceKind } from './scaffoldTypes';
export interface ScaffoldDetail {
	kind: PieceKind;
	summary: string;
	appOnly: boolean;
	contains: string[];
	exampleCommand: string;
}
