// @harness-uid u_ksys4ssrwt
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';

/** Whether the paired computer is online now; `generation` counts every change of that answer. */
export interface PairingState {
	online: boolean;
	generation: number;
}

export interface CapacitorProjectsServiceConfig {
	/** This phone's own Hub account: the projects it owns or was invited to. */
	cloud: DesktopBridge;
	/** The paired computer. What it offers follows its status, so it is read at every use. */
	mac: DesktopBridge;
	/** Read at every use; without it the phone offers no Project Overview. */
	pairing?: () => PairingState;
}

export type Key = keyof DesktopBridge;

export type Input = { projectId?: string; runId?: string };

export type Operation = (input?: Input) => Promise<unknown>;
