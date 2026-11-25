// @harness-uid u_fyf7e7kyi5
import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from '../tracker-host-process-adapter/trackerHostCommand';
import { trackerEgressArguments } from '../../../utils/projects-sessions/trackerEgressPolicy';
import type {
	ClaudeStartupFailure,
	TrackerHostStartRequest
} from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type {
	TrackerManagedCommand,
	TrackerManagedProfiles
} from './trackerManagedHostLauncher.types';

export function validateManagedProfiles(profiles: TrackerManagedProfiles): TrackerManagedProfiles {
	const { native, docker } = profiles;
	const validated = {
		native: native && {
			profile: privateTrackerDirectory(native.profile),
			codex: controlledTrackerExecutable(native.codex),
			claude: controlledTrackerExecutable(native.claude)
		},
		docker: docker && {
			profile: privateTrackerDirectory(docker.profile),
			harness: controlledTrackerExecutable(docker.harness),
			image: docker.image
		}
	};
	if (validated.native && validated.docker?.profile === validated.native.profile)
		throw new TypeError('Tracker native and Docker launcher profiles must be isolated');
	return validated;
}

export function privateTrackerDirectory(path: string): string {
	const directory = realpathSync(path);
	const stat = statSync(directory);
	if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.())
		throw new TypeError('Tracker launch needs a private directory owned by the service user');
	return directory;
}

export function trackerManagedProviderCommand(
	profiles: TrackerManagedProfiles,
	input: TrackerHostStartRequest,
	briefPath: string,
	host: typeof process.platform
): TrackerManagedCommand | undefined {
	const { native, docker } = profiles;
	const { platform, backend, itemId, selection } = input;
	if (platform === 'linux' && backend === 'docker' && docker)
		return {
			home: docker.profile,
			image: docker.image,
			argv: [
				docker.harness,
				'task',
				'orchestrate',
				'--platform',
				'linux',
				'--tracker',
				itemId,
				'--brief',
				briefPath,
				'--model',
				selection.model,
				'--intelligence',
				selection.intelligence || 'medium'
			]
		};
	if (platform !== 'macos' || backend !== 'native' || host !== 'darwin' || !native)
		return undefined;
	const prompt = `Read your brief at ${briefPath} and do that work. Your tracker item is ${itemId}.`;
	return nativeTrackerProviderCommand(native, selection, prompt);
}

function nativeTrackerProviderCommand(
	profile: NonNullable<TrackerManagedProfiles['native']>,
	{ provider, model, intelligence }: TrackerHostStartRequest['selection'],
	prompt: string
): TrackerManagedCommand {
	if (provider === 'claude')
		return {
			home: homedir(),
			username: execFileSync('/usr/bin/id', ['-un'], {
				encoding: 'utf8',
				env: {},
				stdio: ['ignore', 'pipe', 'ignore'],
				timeout: 5000
			}).trim(),
			argv: [
				profile.claude,
				...(profile.egress ? trackerEgressArguments('claude', profile.egress) : []),
				'--dangerously-skip-permissions',
				'--model',
				model,
				...(intelligence ? ['--effort', intelligence] : []),
				prompt
			]
		};
	return {
		home: profile.profile,
		argv: [
			profile.codex,
			...(profile.egress
				? ['-a', 'never', ...trackerEgressArguments('codex', profile.egress)]
				: ['--dangerously-bypass-approvals-and-sandbox']),
			'-m',
			model,
			...(intelligence ? ['-c', `model_reasoning_effort=${JSON.stringify(intelligence)}`] : []),
			prompt
		]
	};
}

export function trackerManagedProviderEnvironment(
	trackerBin: string,
	command: TrackerManagedCommand
): Record<string, string> {
	const { home, username } = command;
	return {
		HOME: home,
		...(username && { USER: username }),
		TERM: 'xterm-256color',
		PATH: `${trackerBin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`
	};
}

export async function trackerClaudeAuthProblem(
	trackerBin: string,
	command: TrackerManagedCommand,
	signal: AbortSignal
): Promise<ClaudeStartupFailure | undefined> {
	try {
		const { code, stdout } = await runTrackerHostCommand(
			command.argv[0],
			['auth', 'status'],
			AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
			{ environment: trackerManagedProviderEnvironment(trackerBin, command) }
		);
		const status = JSON.parse(stdout);
		if (code === 0 && status?.loggedIn === true) return undefined;
		if (code === 1 && status?.loggedIn === false) return 'claude-sign-in';
	} catch {
		signal.throwIfAborted();
	}
	return 'claude-auth-unverified';
}
