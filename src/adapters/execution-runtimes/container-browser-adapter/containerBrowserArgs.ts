// @harness-uid u_nkd2qsvjco
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { ContainerBrowserConfig } from '../ContainerBrowserAdapter.types';

export const browserImage = 'harness-container-browser:1';
export const browserLabel = 'org.harness.container-browser';
const profilePattern = /^[a-z0-9][a-z0-9-]{0,39}$/u;
const screenPattern = /^\d{3,4}x\d{3,4}$/u;

export function containerBrowserName(profile: string): string {
	if (!profilePattern.test(profile))
		throw new ExpectedCliError('Use a lowercase browser profile name, such as x.');
	return `harness-browser-${profile}`;
}

/**
 * The whole confinement of a browser container. It publishes no port: a published or host-network
 * port on a Mac can be reachable from other machines, and DevTools has no authentication.
 */
export function containerBrowserArgs(
	config: ContainerBrowserConfig,
	seccompPath: string
): string[] {
	const name = containerBrowserName(config.profile);
	// Portrait, so a sign-in finished from a phone is readable.
	const screen = config.screen ?? '600x1100';
	if (!screenPattern.test(screen)) throw new ExpectedCliError('Use a WIDTHxHEIGHT screen size.');
	return [
		'run',
		'--detach',
		'--pull=never',
		`--name=${name}`,
		`--hostname=${name}`,
		`--label=${browserLabel}=${config.profile}`,
		'--restart=unless-stopped',
		'--init',
		'--stop-timeout=30',
		'--cap-drop=ALL',
		'--security-opt=no-new-privileges',
		`--security-opt=seccomp=${seccompPath}`,
		'--cpus=2',
		'--memory=3g',
		'--memory-swap=3g',
		'--pids-limit=512',
		'--shm-size=512m',
		'--log-opt=max-size=1m',
		`--mount=type=volume,source=${name}-profile,target=/profile`,
		`--env=BROWSER_SCREEN=${screen}`,
		browserImage
	];
}
