// @harness-uid u_df3xdhg4az
import type { AssistantSlackMediaAdapter } from '../../../adapters/agents-providers/AssistantSlackMediaAdapter';
import type {
	AssistantQuestion,
	AssistantToolDefinition
} from '../../../core/agents-providers/projectAssistant.types';
import { assistantToolDefinition } from '../../../services/agents-providers/project-assistant-service/assistantToolDefinition';
import type { RunbookCanvasState } from '../../../core/agents-providers/runbookCanvas.types';
import type { AssistantRunnerConfig } from './readAssistantConfig.types';

export function assistantSlackTools(
	config: AssistantRunnerConfig,
	slack: AssistantSlackMediaAdapter,
	canvas?: () => Promise<RunbookCanvasState | undefined>
) {
	return ({ channelId }: AssistantQuestion): AssistantToolDefinition[] => {
		const tools: AssistantToolDefinition[] = [];
		if (config.assistant.answerChannels.includes(channelId)) {
			const link = `${config.workspaceUrl}/archives/${channelId}`;
			tools.push(
				assistantToolDefinition(
					'slack_recent_messages',
					'Read recent messages in the current Slack channel.',
					{ fields: {} },
					async () => {
						const messages = await slack.history(channelId);
						return {
							text: messages.map(({ text }) => text.slice(0, 500)).join('\n'),
							sources: messages.slice(0, 3).map(({ ts }) => ({
								label: 'Slack message',
								url: `${link}/p${ts.replace('.', '')}`
							}))
						};
					}
				)
			);
		}
		if (canvas && config.canvas?.channels.includes(channelId))
			tools.push(canvasTool(config, canvas));
		return tools;
	};
}

function canvasTool(
	config: AssistantRunnerConfig,
	canvas: () => Promise<RunbookCanvasState | undefined>
) {
	return assistantToolDefinition(
		'qa_runbooks',
		'Find the shared Slack QA runbooks canvas.',
		{ fields: {} },
		async () => {
			const state = await canvas();
			const available = state?.digest ? state.canvasId : undefined;
			return {
				text: available
					? 'The QA runbooks are available in the shared canvas.'
					: 'The shared canvas is not ready.',
				sources: available
					? [
							{
								label: 'QA runbooks',
								url: `${config.workspaceUrl}/docs/${config.slack.workspaceId}/${available}`
							}
						]
					: []
			};
		}
	);
}
