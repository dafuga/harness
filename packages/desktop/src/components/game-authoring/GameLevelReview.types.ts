import type { LevelProposal } from '../../../../game/src/models/game-authoring/Game.types';
import type { ProviderState } from '../../models/development-tooling/Desktop.types';
import type { LevelStatus } from './GameLevelPlan.types';

export interface GameLevelReviewProps {
	proposal: LevelProposal;
	/** The discovered providers, to name the proposal's model; its ids stand in without them. */
	providers: ProviderState[] | null;
	approved?: boolean;
	built?: boolean;
	status: LevelStatus;
	regenerate: (feedback: string) => void;
	approve: () => void;
	build: () => void;
	edit: () => void;
}
