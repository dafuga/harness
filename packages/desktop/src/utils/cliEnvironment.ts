import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { scrubEnvironment } from './scrubEnvironment';
/** Finder-launched apps inherit a minimal PATH. Extend only task subprocesses. */
export function cliEnvironment(): NodeJS.ProcessEnv {
	const env = scrubEnvironment();
	const paths = [
		...new Set([
			...(env.PATH ?? '').split(delimiter).filter(Boolean),
			join(homedir(), '.local/bin'),
			join(homedir(), '.bun/bin'),
			'/opt/homebrew/bin',
			'/usr/local/bin',
			'/usr/bin',
			'/bin'
		])
	];
	return { ...env, PATH: paths.join(delimiter) };
}
