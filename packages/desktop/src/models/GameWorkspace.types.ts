import type { DesktopBridge } from './DesktopBridge.types';

export interface GameWorkspaceProps {
	projectId?: string | null;
	commit?: string;
	readonly?: boolean;
	bridge?: DesktopBridge;
}
