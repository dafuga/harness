import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const executable = join(dirname(process.execPath), 'CodexHarnessElectron');
const dataPath = join(homedir(), 'Library/Application Support/Codex Harness Experimental');
const child = Bun.spawn([executable, `--user-data-dir=${dataPath}`, ...process.argv.slice(2)], {
	stdin: 'inherit',
	stdout: 'inherit',
	stderr: 'inherit'
});
process.exit(await child.exited);
