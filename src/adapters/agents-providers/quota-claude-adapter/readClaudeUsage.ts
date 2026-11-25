import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { quotaProcessEnvironment } from '../quotaProcessEnvironment';

const exec = promisify(execFile);
const composer = /^\s*❯\s*$/m;
const enteredUsage = /^\s*❯\s*\/usage\s*$/m;
const trustDialog = 'Quick safety check';
const trustChoice = /^\s*❯\s+(?:\d+\.\s+)?Yes, I trust this folder\s*$/m;
const args = [
	'--setting-sources',
	'',
	'--strict-mcp-config',
	'--mcp-config',
	'{"mcpServers":{}}',
	'--tools',
	''
];

type Tmux = (...args: string[]) => Promise<string>;

/** Uses a private server and a dedicated folder. No terminal output or auth response is logged. */
export async function readClaudeUsage(): Promise<string> {
	if (process.platform !== 'darwin') return '';
	const env = {
		...quotaProcessEnvironment(),
		NO_COLOR: '1',
		DISABLE_AUTOUPDATER: '1',
		CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
	};
	if (!(await hasClaudeSubscription(env))) return '';
	const directory = await claudeQuotaDirectory();
	if (!directory) return '';
	const scratch = await mkdtemp(join(tmpdir(), 'hq-'));
	const run: Tmux = async (...args) =>
		(
			await exec('tmux', ['-S', join(scratch, 's'), '-f', '/dev/null', ...args], {
				env,
				timeout: 1500,
				maxBuffer: 32 * 1024
			})
		).stdout;
	try {
		await run('new-session', '-d', '-x', '168', '-y', '55', '-c', directory, 'claude', ...args);
		return (await openUsage(run, directory)) ? await usagePanel(run) : '';
	} finally {
		await run('kill-server').catch(() => undefined);
		await rm(scratch, { recursive: true, force: true });
	}
}

async function claudeQuotaDirectory(): Promise<string | null> {
	const folder = join(homedir(), 'Library', 'Caches', 'harness-claude-quota');
	await mkdir(folder, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== 'EEXIST') throw error;
	});
	const stat = await lstat(folder);
	if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
		return null;
	return await realpath(folder);
}

async function hasClaudeSubscription(env: NodeJS.ProcessEnv): Promise<boolean> {
	try {
		const { stdout } = await exec('claude', ['auth', 'status', '--json'], {
			env,
			cwd: tmpdir(),
			timeout: 3000,
			maxBuffer: 4096
		});
		const status = JSON.parse(stdout);
		return status?.loggedIn === true && status?.authMethod === 'claude.ai';
	} catch {
		return false;
	}
}

async function openUsage(run: Tmux, directory: string): Promise<boolean> {
	let granted = false;
	for (let attempt = 0; attempt < 18; attempt++) {
		await delay(300);
		const screen = await run('capture-pane', '-p');
		if (screen.includes(trustDialog)) {
			if (!granted) granted = await trustOwnFolder(run, screen, directory);
			continue;
		}
		if (!composer.test(screen)) continue;
		await run('send-keys', '-l', '/usage');
		await delay(250);
		const input = await run('capture-pane', '-p');
		if (!enteredUsage.test(input) || !/show.*(?:usage|plan)|(?:usage|plan).*limits/i.test(input))
			return false;
		await run('send-keys', 'Enter');
		return true;
	}
	return false;
}

async function trustOwnFolder(run: Tmux, screen: string, directory: string): Promise<boolean> {
	if (!screen.split('\n').some((line) => line.trim() === directory)) return false;
	if (!trustChoice.test(screen)) await run('send-keys', 'Down');
	await delay(200);
	if (!trustChoice.test(await run('capture-pane', '-p'))) return false;
	await run('send-keys', 'Enter');
	return true;
}

async function usagePanel(run: Tmux): Promise<string> {
	for (let attempt = 0; attempt < 24; attempt++) {
		await delay(250);
		const screen = await run('capture-pane', '-p');
		if (/could not load usage data|failed to load usage/i.test(screen)) return '';
		if (/^\s*Current (?:session|week)/m.test(screen) && /^\s*[^a-z\d]*\d+% used/m.test(screen))
			return screen;
	}
	return '';
}
