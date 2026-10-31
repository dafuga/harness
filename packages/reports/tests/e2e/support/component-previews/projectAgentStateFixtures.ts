import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';
import { desktopAgentActivityVariant } from './desktopAgentActivityVariants';
import { projectAgentRunFixture } from './projectAgentRunFixture';

/** Each declared state now uses the committed DesktopBridge request, comment and event seams. */
export function projectAgentStateFixture(
	data: DesktopData,
	base: PreviewProps,
	state: ProjectAgentState
): PreviewProps {
	projectAgentRunFixture(data, state);
	const providers = data.bridge.providers;
	data.bridge.providers = async () =>
		(await providers()).map((provider) => ({
			...provider,
			models: provider.models.map((model) => ({
				...model,
				id: 'gpt-6.1-sol',
				label: 'GPT-6.1 Sol'
			}))
		}));
	if (state === 'no-provider') data.bridge.providers = async () => [];
	if (state.startsWith('agents-')) projectAgents(data, state);
	return { ...base, workspace: data.workspace, open: state !== 'closed' };
}

function projectAgents(data: DesktopData, state: ProjectAgentState) {
	desktopAgentActivityVariant(data, state);
	const activity = data.bridge.agentActivity;
	if (!activity) return;
	data.bridge.agentActivity = async (...args) => {
		const reading = await activity(...args);
		return {
			...reading,
			agents: {
				...reading.agents,
				roster: reading.agents.roster.map((agent, index) => ({
					...agent,
					id: `orders-review-${index + 1}`,
					label: `Order review ${index + 1}`,
					task: `Review order-card state ${index + 1}`
				}))
			}
		};
	};
}
