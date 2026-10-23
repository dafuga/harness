import type {
	Dimension,
	LevelPlanning
} from '../../../../game/src/models/game-authoring/Game.types';
import type { ProviderId, ProviderState } from '../../models/development-tooling/Desktop.types';
import type { LevelStatus, LevelStep } from './GameLevelPlan.types';

export interface GameLevelBriefProps {
	/** The concept alone first, then the brief with its dimension and model. */
	step: LevelStep;
	planning: LevelPlanning;
	dimension: Dimension;
	/** The discovered local providers; null until known, or where none are looked for. */
	providers: ProviderState[] | null;
	provider: ProviderId;
	model: string;
	status: LevelStatus;
	/** The current proposal still matches this brief, so its review can be reopened. */
	reviewable?: boolean;
	revise: (patch: Partial<LevelPlanning>) => void;
	reshape: (dimension: Dimension) => void;
	generate: () => void;
	go: (step: LevelStep) => void;
}
