// @harness-uid u_rasgr3cqn3
// @harness-uid u_tbe6r9tzdf
import type { TrackerBundleInput } from './TrackerBundleService.types';
import type { TrackerBundleLayout } from './trackerBundleLayout.types';
import type { inspectLink } from './replaceSymlink';

export type LinkState = Awaited<ReturnType<typeof inspectLink>>;

export interface ActivateInput {
	input: TrackerBundleInput;
	layout: TrackerBundleLayout;
	/** The running service's command line, or null when no service is installed yet. */
	program: string[] | null;
	executable: string;
	before: { launcher: LinkState; entry: LinkState };
}

export type Activation =
	| { status: 'rolled-back'; reason: string }
	| {
			status: 'ok';
			outcome: 'current' | 'installed' | 'cli-only';
			restarted: boolean;
			previousRelease: string | null;
	  };
