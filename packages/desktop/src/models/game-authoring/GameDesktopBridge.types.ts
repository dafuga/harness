import type {
	GameDocument,
	CheckpointImage,
	RenderSessionRequest,
	RenderSession
} from '../../../../game/src/models/game-authoring/Game.types';
import type { ProjectSnapshot } from '../development-tooling/Desktop.types';
export interface GameDesktopBridge {
	gameImageGenerate?(input: {
		projectId: string;
		document: GameDocument;
		viewId: string;
		checkpointId: string;
		expectedRevision: string;
	}): Promise<{ image: CheckpointImage; dataUrl: string }>;
	gameImageRead?(input: { projectId: string; path: string; commit?: string }): Promise<string>;
	gameCreate?(input: {
		name: string;
		kind: 'app' | 'game';
		dimension: '2d' | '3d';
	}): Promise<ProjectSnapshot>;
	gameRead?(input: {
		projectId: string;
		commit?: string;
	}): Promise<{ document: GameDocument; revision: string }>;
	gameSave?(input: {
		projectId: string;
		document: GameDocument;
		expectedRevision: string;
	}): Promise<{ revision: string }>;
	gameRender?(input: RenderSessionRequest): Promise<RenderSession>;
}
