import type {
	GithubConnectionControllerOptions,
	GithubConnection
} from './GithubConnectionController.types';
import type { GithubStatus } from '../../../../../models/accounts-access/HubAuth.types';
import { authFail } from '../../../../../utils/accounts-access/authFail';
import { authHttp } from '../../../../../utils/verification-evidence/authHttp';
import { authRedirect } from './authHttp';
import type { AuthRoutes } from '../../../../../utils/verification-evidence/authHttp';
import { AuthRequestValidator } from '../../../../../validators/accounts-access/AuthRequestValidator';

const NOT_CONFIGURED: GithubStatus = { configured: false, connected: false, login: null };

/** `/api/github/*`. No route here returns a token or accepts an installation id. */
export class GithubConnectionController {
	private readonly input = new AuthRequestValidator();

	constructor(private readonly options: GithubConnectionControllerOptions) {}

	routes(): AuthRoutes {
		return {
			'GET /api/github/status': (request) => this.status(request),
			'GET /api/github/connect': (request) => this.connect(request),
			'GET /api/github/callback': (request) => this.callback(request),
			'GET /api/github/repositories': (request) => this.repositories(request),
			'POST /api/github/disconnect': (request) => this.disconnect(request)
		};
	}

	private github(): GithubConnection {
		return this.options.github ?? authFail('github-disabled');
	}

	private async status(request: Request): Promise<Response> {
		const { actor } = await this.options.sessions.required(request);
		const github = this.options.github;
		return authHttp(github ? await github.grants.status(actor) : NOT_CONFIGURED);
	}

	/** A top-level navigation from the hub itself, by a signed-in browser. */
	private async connect(request: Request): Promise<Response> {
		if (request.headers.get('sec-fetch-site') === 'cross-site') return authFail('origin-denied');
		const session = await this.options.sessions.browser(request);
		return authRedirect(await this.github().grants.begin(session));
	}

	/** Lands on a fixed page either way. The reason for a failure is never put in the URL. */
	private async callback(request: Request): Promise<Response> {
		const { origin, sessions } = this.options;
		try {
			const session = await sessions.browser(request);
			const input = this.input.githubCallback(new URL(request.url));
			if (!input) return authFail('github-not-connected');
			await this.github().grants.complete(session, input);
			return authRedirect(`${origin}/?github=connected`);
		} catch {
			return authRedirect(`${origin}/?github=failed`);
		}
	}

	private async repositories(request: Request): Promise<Response> {
		const { actor } = await this.options.sessions.required(request);
		return authHttp(await this.github().owner.repositories(actor));
	}

	private async disconnect(request: Request): Promise<Response> {
		const { actor } = await this.options.sessions.required(request);
		await this.github().grants.disconnect(actor);
		return authHttp({ ok: true });
	}
}

export type {
	GithubConnection,
	GithubConnectionControllerOptions
} from './GithubConnectionController.types';
