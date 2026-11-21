// @harness-uid u_hcdv6alnyy
import { ExpectedCliError } from '../../core/errors';
import type {
	ProviderSignInDeps,
	ProviderSignInSpec,
	ProviderSignInStatus,
	SignInProviderId
} from './ProviderSignInCommand.types';

/** Fixed official sign-in commands; provider ids outside this map never reach a process. */
const SIGN_IN_SPECS: Readonly<Record<SignInProviderId, ProviderSignInSpec>> = {
	chatgpt: { label: 'Codex CLI', command: 'codex', args: ['login'] },
	claude: { label: 'Claude CLI', command: 'claude', args: ['auth', 'login'] },
	gemini: { label: 'Gemini CLI', command: 'gemini', args: [] }
};

/** Reports local sign-in availability and dispatches the recognized official provider command. */
export class ProviderSignInCommand {
	constructor(private readonly deps: ProviderSignInDeps) {}

	status(provider: string): ProviderSignInStatus {
		const spec = this.spec(provider);
		return {
			provider,
			command: spec.command,
			available: this.deps.locate(spec.command) !== null
		};
	}

	async run(provider: string): Promise<number> {
		const spec = this.spec(provider);
		const executable = this.deps.locate(spec.command);
		if (executable === null) throw new ExpectedCliError(`${spec.label} is not installed.`);
		try {
			return await this.deps.launch(executable, spec.args);
		} catch {
			throw new ExpectedCliError(`Could not start ${spec.label}.`);
		}
	}

	private spec(provider: string): ProviderSignInSpec {
		if (!Object.hasOwn(SIGN_IN_SPECS, provider)) {
			throw new ExpectedCliError('Unknown sign-in provider.');
		}
		return SIGN_IN_SPECS[provider as SignInProviderId];
	}
}
