import { providerProgram } from './trackerManagedProviderProgram';
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
const stateFile = join(__dirname, 'account-home', '.claude-session-fixture');
if (args.includes('capture-pane')) {
	const mode = fs.readFileSync(stateFile, 'utf8');
	const screens = {
		onboarding: 'Choose the text style that looks best with your terminal\\n',
		'locked-keychain': '────────────\\n❯\\u00A0\\n────────────\\n  ⏵⏵ bypass permissions on\\n  Not logged in - run security unlock-keychain\\n',
		untrusted: ' Accessing workspace:\\n\\n Quick safety check: Is this a project you created or one you trust?\\n\\n ❯ No, exit\\n   Yes, I trust this folder\\n\\n Enter to confirm · Esc to cancel\\n',
		crash: 'Error: synthetic launcher crash\\n'
	};
	process.stdout.write(screens[mode] ?? '────────────\\n❯\\u00A0\\n────────────\\n  ⏵⏵ bypass permissions on\\n');
	process.exit(0);
}
if (args.includes('display-message')) {
	process.stdout.write(fs.readFileSync(join(__dirname, 'pane-cwd-' + target), 'utf8') + '\\n');
	process.exit(0);
}
if (args.includes('if-shell') && args.at(-1).includes('send-keys')) {
	fs.appendFileSync(join(__dirname, 'trust-keys'), args.at(-1) + '\\n');
	fs.writeFileSync(stateFile, 'ready');
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
fs.appendFileSync(join(__dirname, 'launch-sockets'), args[args.indexOf('-L') + 1] + '\\n');
if (fs.existsSync(join(__dirname, 'tmux-refuses'))) {
	process.stderr.write('create window failed: synthetic refusal\\n');
	process.exit(1);
}
const dir = args.indexOf('-c');
const [command, ...workerArgs] = args.slice(dir + 2);
const sessionArg = args[args.indexOf('-s') + 1];
fs.writeFileSync(join(__dirname, 'pane-cwd-' + sessionArg), fs.realpathSync(args[dir + 1]));
if (args.includes('-n')) fs.appendFileSync(join(__dirname, 'window-names'), args[args.indexOf('-n') + 1] + '\\n');
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

export function seedManagedBriefItems(runtime: TrackerNativeRuntimeService, itemId: string) {
	runtime.store.appendLocal({
		itemId: 'parent0001',
		fields: {
			title: 'Parent assignment',
			notes: 'Inspect the pending sibling.',
			kind: 'task',
			status: 'open'
		}
	});
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: 'Synthetic Docker work',
			status: 'open',
			kind: 'task',
			project: 'Harness',
			parent: 'parent',
			due: '2099-03-04'
		}
	});
}
