// @harness-uid u_ihonyzbmoj
import type { ClaudeMessagesAdapter } from '../../../adapters/agents-providers/ClaudeMessagesAdapter';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import type { SlackAdapter } from '../../../adapters/agents-providers/SlackAdapter';
import type { AssistantSlackMediaAdapter } from '../../../adapters/agents-providers/AssistantSlackMediaAdapter';
import type { TrackerNoteAdapter } from '../../../adapters/agents-providers/TrackerNoteAdapter';
import type { PlanAssistantQaRecording } from './assistantQaRecorder.types';
import type { AssistantQaConfig } from './readAssistantConfig.types';

export interface AssistantQaSettings {
	options: AssistantQaConfig;
	root: string;
	workspaceUrl: string;
	stagingBranch: string;
	healthUrl: string;
	since: string;
	plan: PlanAssistantQaRecording;
}

export interface AssistantQaRuntime {
	github: GitHubAppAdapter;
	model: ClaudeMessagesAdapter;
	slack: SlackAdapter;
	media: AssistantSlackMediaAdapter;
	trackerNotes: TrackerNoteAdapter;
}
