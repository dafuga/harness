import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import { desktopShellVariant } from './desktopShellVariants';
import { desktopRuntimeVariant } from './desktopRuntimeVariants';
import { desktopAgentActivityVariant } from './desktopAgentActivityVariants';

export function desktopPreviewVariant(
	id: string,
	props: PreviewProps,
	data: DesktopData,
	variant: string
): PreviewProps {
	if (!variant) return props;
	if (id === 'desktop.component.agents-providers-chat-agents')
		desktopAgentActivityVariant(data, variant);
	return (
		desktopShellVariant(id, props, data, variant) ??
		desktopRuntimeVariant(id, props, data, variant) ??
		props
	);
}
