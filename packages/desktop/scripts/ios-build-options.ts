import { fileURLToPath } from 'node:url';

/** What one simulator build is asked to be. */
export interface IosBuildPlan {
	configuration: 'Debug' | 'Release';
	/** TEST ONLY: a Debug product prepared for the local test relay. Never a Release product. */
	fixture: boolean;
	/** Build the renderer and copy it into the native project first. */
	sync: boolean;
}

const known = ['--sync', '--fixture', '--release'];
export const fixtureNeedsDebug =
	'A fixture build is a Debug build: --fixture cannot be combined with --release. A Release product never accepts a local relay.';

/**
 * Reads the command line of the simulator build. It is decided here, before anything is built,
 * that a test fixture can only be a Debug product and that an unknown option is not ignored.
 */
export function iosBuildPlan(args: string[]): IosBuildPlan | { error: string } {
	const unknown = args.find((item) => !known.includes(item));
	if (unknown) return { error: `Unknown option ${unknown}. Known: ${known.join(', ')}.` };
	const fixture = args.includes('--fixture');
	const release = args.includes('--release');
	if (fixture && release) return { error: fixtureNeedsDebug };
	return { configuration: release ? 'Release' : 'Debug', fixture, sync: args.includes('--sync') };
}

/**
 * Signing of every simulator product: ad hoc, "to run locally". No team, no account, no
 * certificate and no provisioning profile is named or used; a device build needs all of them and
 * is not made here. Without a signature the simulator's Keychain refuses to keep a pairing.
 *
 * The identity the simulator gives the app comes from entitlements that are linked into the
 * executable. Left to itself, Xcode writes them and puts a team of whatever account is signed in
 * to it in front of the app's identifier, also when no team is named. So the build names its own
 * entitlements, the app's identifier alone, and lets Xcode add none.
 */
export const simulatorEntitlements = fileURLToPath(
	new URL('../ios/App/Simulator.entitlements', import.meta.url)
);
export const simulatorSigning = [
	'CODE_SIGN_IDENTITY=-',
	'CODE_SIGNING_REQUIRED=NO',
	'DEVELOPMENT_TEAM=',
	'CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO',
	`CODE_SIGN_ENTITLEMENTS=${simulatorEntitlements}`
];
