// @harness-uid u_h6kmqtpvuk
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

/** Owner-only runtime files of one browser profile: viewer devices and the noVNC client. */
export function containerBrowserState(profile: string, directory?: string): string {
	return directory ?? join(homedir(), '.harness', 'container-browser', profile);
}

/** Finds the image sources both from this checkout and from a bundled CLI. */
export function containerBrowserSources(from: string = dirname(fileURLToPath(import.meta.url))): {
	image: string;
	seccomp: string;
} {
	for (let directory = from; ; directory = dirname(directory)) {
		const image = join(directory, 'deploy', 'container-browser');
		const seccomp = join(directory, 'deploy', 'vault', 'seccomp.json');
		if (existsSync(join(image, 'Dockerfile')) && existsSync(seccomp)) return { image, seccomp };
		if (dirname(directory) === directory)
			throw new ExpectedCliError('Run this from a Harness checkout with deploy/container-browser.');
	}
}
