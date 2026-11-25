// @harness-uid u_ovkxav7k5o
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

/** Native clients use the local account. API keys and provider overrides stay outside this process. */
export function quotaProcessEnvironment(): Record<string, string | undefined> {
	const home = homedir();
	return {
		HOME: home,
		USER: process.env.USER,
		LOGNAME: process.env.LOGNAME,
		TMPDIR: process.env.TMPDIR,
		PATH: [
			join(home, '.local/bin'),
			join(home, '.npm-global/bin'),
			'/opt/homebrew/bin',
			'/usr/local/bin',
			'/usr/bin',
			'/bin'
		].join(delimiter),
		LANG: 'en_US.UTF-8',
		LC_ALL: 'en_US.UTF-8',
		TZ: 'UTC'
	};
}
