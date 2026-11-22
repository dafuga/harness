// @harness-uid u_yga4vj5ueo
import type { RunMode, RunProfile } from './HarborInspectionCommand.types';

// SDK-backed modes run the installed Harbor App SDK; scaffold gets extra time for its nested Harness call.
export const HARBOR_RUN_PROFILES: Record<RunMode, RunProfile> = {
	inspect: {
		sdk: false,
		timeoutMs: 3000,
		failure: 'The installed Harbor CLI reported an inspection error.',
		stopped: 'Could not inspect Harbor through its installed CLI.'
	},
	publish: {
		sdk: true,
		timeoutMs: 780_000,
		failure:
			'Harbor could not complete publication. Check the testnet profile and local verification record.',
		stopped: 'Harbor publication stopped.'
	},
	tool: {
		sdk: true,
		timeoutMs: 120_000,
		failure: 'The installed Harbor SDK reported an app tooling error.',
		stopped: 'Could not run Harbor app tooling through its installed SDK.'
	},
	scaffold: {
		sdk: true,
		timeoutMs: 150_000,
		failure: 'The installed Harbor SDK could not scaffold the app.',
		stopped: 'Harbor app scaffolding stopped.'
	}
};
