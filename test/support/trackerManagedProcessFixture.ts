import { loadTrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const fixtureDockerImage = 'sha256:' + 'a'.repeat(64);

export function managedFixtureBindings(root: string) {
	const stateDirectory = join(root, 'effects');
	const native = join(root, 'native-profile');
	const docker = join(root, 'docker-profile');
	const accountHome = join(root, 'account-home');
	for (const dir of [stateDirectory, native, docker, accountHome]) mkdirSync(dir, { mode: 0o700 });
	writeFileSync(join(accountHome, '.claude-session-fixture'), 'ready', { mode: 0o600 });
	const tmux = fixtureProgram(root, 'tmux', tmuxProgram);
	const harness = fixtureProgram(root, 'harness', providerProgram);
	const codex = fixtureProgram(root, 'codex', providerProgram);
	const claude = fixtureProgram(root, 'claude', providerProgram);
	return {
		profiles: { native, docker, accountHome },
		config: {
			tmux,
			stateDirectory,
			trackerBinDirectory: root,
			docker: { harness, profile: docker, image: fixtureDockerImage },
			native: { codex, claude, profile: native }
		}
	};
}

function fixtureProgram(root: string, name: string, program: string) {
	const path = join(root, name);
	writeFileSync(path, `#!${process.execPath}\n${program}`, { mode: 0o700 });
	return path;
}

const tmuxProgram = `
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const fs = require('node:fs');
const { join } = require('node:path');
const target = args[args.indexOf('-t') + 1]?.replace(/^=/, '').replace(/:$/, '');
const pane = (name) => join(__dirname, 'claude-pane-' + name);
if (args.includes('capture-pane')) {
	const screens = {
		onboarding: 'Choose the text style that looks best with your terminal\\n',
		untrusted: ' Accessing workspace:\\n /work/tree\\n Quick safety check: Is this a project you created or one you trust? (Like your\\n'
	};
	process.stdout.write(screens[fs.readFileSync(join(__dirname, 'account-home', '.claude-session-fixture'), 'utf8')]
		?? '────────────\\n❯\\u00A0\\n────────────\\n  ⏵⏵ bypass permissions on\\n');
	process.exit(0);
}
if (args.includes('if-shell')) fs.rmSync(pane(target), { force: true });
if (args.includes('list-panes') || args.includes('if-shell')) process.exit(0);
if (args.includes('show-environment')) {
	const override = join(__dirname, 'tmux-presence');
	const file = fs.existsSync(override) ? override : pane(target);
	const reply = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
	const matches = reply.startsWith('HARNESS_TRACKER_ATTEMPT=');
	(matches ? process.stdout : process.stderr).write(reply || 'no such session: =' + target);
	process.exit(matches ? 0 : 1);
}
if (!args.includes('new-session')) process.exit(2);
const dir = args.indexOf('-c');
const [command, ...workerArgs] = args.slice(dir + 2);
if (workerArgs.includes(join(__dirname, 'claude'))) {
	fs.writeFileSync(pane(args[args.indexOf('-s') + 1]), args[args.indexOf('-e') + 1]);
}
const run = spawnSync(command, workerArgs, {
	cwd: args[dir + 1], env: { ...process.env, FIXTURE_SECRET: 'synthetic' }, stdio: 'inherit'
});
if (run.status !== 0) process.exit(run.status || 3);
// The start reply is lost after the synthetic provider has exited.
process.exit(1);
`;

const providerProgram = `
const { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, join } = require('node:path');
const argv = process.argv.slice(2);
if (basename(process.argv[1]) === 'claude') {
	const mode = join(process.env.HOME, '.claude-session-fixture');
	if (!existsSync(mode)) process.exit(41);
	if (process.env.USER !== require('node:os').userInfo().username) process.exit(42);
	const startup = readFileSync(mode, 'utf8');
	if (argv[0] === 'auth' && argv[1] === 'status') {
		if (startup === 'unverified') { process.stdout.write('synthetic private diagnostic'); process.exit(2); }
		const loggedIn = startup !== 'signed-out';
		process.stdout.write(JSON.stringify({ loggedIn, authMethod: loggedIn ? 'claude.ai' : 'none' }));
		process.exit(loggedIn ? 0 : 1);
	}
	if (startup === 'onboarding' || startup === 'untrusted') process.exit(0);
}
if (basename(process.argv[1]) === 'codex') {
	const timestamp = new Date().toISOString();
	const dir = join(process.env.HOME, '..', 'tracker-test-codex-transcripts',
		timestamp.slice(0, 10).replaceAll('-', '/'));
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	const cwd = process.cwd();
	const usage = { input_tokens: 120, cached_input_tokens: 25, output_tokens: 10 };
	const competing = existsSync(join(process.env.HOME, '..', 'competing-codex-transcript'));
	const session = (id) => ({ type: 'session_meta', payload: { id, cwd, timestamp, base_instructions: 'x'.repeat(30 * 1024) } });
	const counters = { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: usage } } };
	for (const suffix of competing ? ['1', '2'] : ['1']) {
		const id = '9c0f0000-0000-4000-8000-00000000000' + suffix;
		writeFileSync(join(dir, 'rollout-' + timestamp + '-' + id + '.jsonl'), [
			session(id), { type: 'event_msg', payload: { type: 'user_message', message: 'synthetic transcript text' } },
			counters
		].map(JSON.stringify).join('\\n') + '\\n', { mode: 0o600, flag: 'wx' });
	}
}
const briefPath = argv.includes('--brief') ? argv[argv.indexOf('--brief') + 1] : argv.at(-1)?.match(/^Read your brief at (.+) and do that work/)[1];
appendFileSync(join(process.env.HOME, 'invoked.ndjson'), JSON.stringify({
	argv, cwd: process.cwd(), image: process.env.HARNESS_TASK_DOCKER_IMAGE ?? null,
	user: process.env.USER ?? null, secret: Boolean(process.env.FIXTURE_SECRET),
	brief: briefPath && readFileSync(briefPath, 'utf8'),
	client: JSON.parse(readFileSync(process.env.HARNESS_TRACKER_CONFIG, 'utf8')),
	legacy: process.env.HARNESS_TRACKER_LEGACY_BIN,
	guestAuthFile: process.env.HARNESS_TRACKER_GUEST_AUTH_FILE ?? null
}) + '\\n');
`;

export function seedRetainedRuns(db: DatabaseSync, now: number) {
	for (let id = 1; id <= 8; id++) {
		db.prepare(
			`INSERT INTO runs(id,item_id,auto_token,rung,cli,model,state,queued_at,started_at,ended_at,tmux)
			VALUES (?,?,'legacy','sol','codex','gpt-6.2-sol',?,?,?,?,?)`
		).run(
			id,
			'old00' + id + 'abcd',
			id === 8 ? 'finished' : 'running',
			now,
			now,
			id === 8 ? now : null,
			'auto-old00' + id + '-r' + id
		);
	}
}

export function managedTrackerItemRequest(
	runtime: TrackerNativeRuntimeService,
	itemId: string,
	action: string
) {
	return runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${itemId}/${action}`, {
			method: 'POST',
			body: '{}'
		})
	);
}

export function managedForegroundConfig(
	root: string,
	managed: ReturnType<typeof managedFixtureBindings>['config'],
	platform: 'linux' | 'macos' = 'linux',
	ops?: string
) {
	const path = join(root, 'foreground.json');
	const syncSecretFile = join(root, 'secret');
	writeFileSync(syncSecretFile, 'synthetic-host-worker-wire-key', { mode: 0o600 });
	const config = {
		version: 1,
		autolaunch: { enabled: true },
		node: 'daniel-primary-mbp',
		role: 'hub',
		apiPort: 49281,
		syncPort: 49282,
		database: join(root, 'test-db'),
		legacyFenceFile: join(root, 'fence'),
		syncSecretFile,
		hostEffects: {
			mode: 'active',
			checkpoint: 'fixture',
			...(platform === 'macos' && {
				watchdog: { transcriptRoots: [join(root, 'tracker-test-codex-transcripts')] }
			}),
			launch: {
				maxConcurrent: 1,
				legacyRunDirectory: root,
				managed: { ...managed, ...(ops && { opsWorkdir: ops }) },
				...(ops && { due: true }),
				repositories: { Harness: { repo: root, platform } }
			}
		}
	};
	writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
	return loadTrackerNodeConfig(path);
}

export function seedCompletedRetainedRun(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	now: number
) {
	seedRetainedRuns(database, now);
	runtime.store.appendLocal({
		itemId: 'old008abcd',
		fields: { title: 'Finished fixture', kind: 'task', status: 'done' }
	});
}
