import type {
	GameDocument,
	RenderSessionRequest,
	RenderSession
} from '../../../game/src/models/Game.types';
import type { ProjectSnapshot } from './Desktop.types';
export interface GameDesktopBridge {
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
