import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';

export interface CapacitorProjectsServiceConfig {
	/** This phone's own Hub account: the projects it owns or was invited to. */
	cloud: DesktopBridge;
	/** The paired computer. What it offers follows its status, so it is read at every use. */
	mac: DesktopBridge;
}

export type Key = keyof DesktopBridge;

export type Input = { projectId?: string; runId?: string };

export type Operation = (input?: Input) => Promise<unknown>;
