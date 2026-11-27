// @harness-uid u_lfsepf33oh
import type { XUrlState } from './classifyXUrl.types';

export interface XTab {
	/** The tab's current state, from its address only. */
	state(): Promise<XUrlState>;
	pause(ms: number): Promise<void>;
}
