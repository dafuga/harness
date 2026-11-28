// @harness-uid u_mrsb2rmpyo
import type { PlatformAdapter } from '../../core/agents-providers/platformAdapter.types';
import type { ProjectAssistantService } from './ProjectAssistantService';

export interface SlackAssistantServiceOptions {
	slack: Pick<PlatformAdapter, 'subscribe' | 'send'>;
	assistant: Pick<ProjectAssistantService, 'answer'>;
	botUserId: string;
	report(
		code: 'assistant-answer-failed' | 'assistant-reply-failed' | 'assistant-send-failed'
	): void;
}
