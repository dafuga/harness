// @harness-uid u_kg5hqp3stu
import type { AssistantToolDefinition } from '../../../core/agents-providers/projectAssistant.types';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import type { HealthProbeAdapter } from '../../../adapters/agents-providers/HealthProbeAdapter';
import type { TrackerCliAdapter } from '../../../adapters/agents-providers/TrackerCliAdapter';
import { githubReadTools } from './githubTools';
import { healthTool, trackerReadTools, writeTools } from './otherTools';

/** The complete tool set. Reads first, then the three writers-only creates. No deploy or merge tool exists. */
export function assistantTools(
	github: GitHubAppAdapter,
	tracker: TrackerCliAdapter,
	health: HealthProbeAdapter
): AssistantToolDefinition[] {
	return [
		...githubReadTools(github),
		...trackerReadTools(tracker),
		...healthTool(health),
		...writeTools(github, tracker)
	];
}
