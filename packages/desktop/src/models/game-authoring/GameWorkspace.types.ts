import type { DesktopBridge } from '../development-tooling/DesktopBridge.types';

export interface GameWorkspaceProps {
	projectId?: string | null;
	commit?: string;
	readonly?: boolean;
	bridge?: DesktopBridge;
}
