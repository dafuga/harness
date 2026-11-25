// @harness-uid u_dv4lnm54rz
import type { trackerBlockerTypes } from './trackerBlockerTypes';

export type TrackerBlockerType = (typeof trackerBlockerTypes)[number];

/** Where a blocker goes: Daniel's inbox, the owning orchestrator, its owner, or the item it waits on. */
export type TrackerBlockerRoute = 'needs_daniel' | 'orchestrator' | 'owner' | 'dependency';

export interface TrackerBlockerClassification {
	readonly type: TrackerBlockerType;
	/** The item this blocker waits on, when the text names one. */
	readonly waitsOn: string | null;
}
