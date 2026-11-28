// @harness-uid u_jnjcxmplge
import type { HomeAskOption } from '$reports/lib/projects-sessions/hub-home/hubHome.types';

export interface HomeChoice {
	/** The option's 1-based number in the ask, which is what the tracker records. */
	number: number;
	option: HomeAskOption;
}
