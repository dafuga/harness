import type { PieceKind } from './scaffoldTypes';
export interface ScaffoldDetail {
	kind: PieceKind;
	summary: string;
	appOnly: boolean;
	gameOnly?: boolean;
	contains: string[];
	exampleCommand: string;
}
