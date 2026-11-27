// @harness-uid u_r7qgepnoax
import type {
	LandingRequest,
	LandingDecision
} from '../../../services/projects-sessions/tracker-hub-sync/trackerLandingQueue.types';
export type LandingPort = (request: LandingRequest) => Promise<LandingDecision>;
export type Checkout = { sha: string; branch: string; repo: string };
