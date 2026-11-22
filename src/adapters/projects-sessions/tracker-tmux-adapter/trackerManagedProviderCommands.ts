// @harness-uid u_fyf7e7kyi5
import { realpathSync, statSync } from 'node:fs';
import { controlledTrackerExecutable } from '../tracker-host-process-adapter/trackerHostCommand';
import type { TrackerHostStartRequest } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
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
			profile: docker.profile,
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
	return {
		profile: native.profile,
		argv: nativeTrackerProviderCommand(native, selection, prompt)
	};
}

function nativeTrackerProviderCommand(
	profile: NonNullable<TrackerManagedProfiles['native']>,
	{ provider, model, intelligence }: TrackerHostStartRequest['selection'],
	prompt: string
): string[] {
	if (provider === 'claude')
		return [
			profile.claude,
			'--permission-mode',
			'acceptEdits',
			'--model',
			model,
			...(intelligence ? ['--effort', intelligence] : []),
			prompt
		];
	return [
		profile.codex,
		'--sandbox',
		'workspace-write',
		'-m',
		model,
		...(intelligence ? ['-c', `model_reasoning_effort=${JSON.stringify(intelligence)}`] : []),
		prompt
	];
}
