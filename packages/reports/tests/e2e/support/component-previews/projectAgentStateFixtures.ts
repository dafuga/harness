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
	if (state === 'no-provider') data.bridge.providers = async () => [];
	if (state.startsWith('agents-')) desktopAgentActivityVariant(data, state);
	return { ...base, workspace: data.workspace, open: state !== 'closed' };
}
