import { hostedPublicFailure } from '../utils/hostedPublicFailure';
import { HostedFailureValidator } from '../validators/HostedFailureValidator';
import { RemoteProjectResponseValidator } from '../validators/RemoteProjectResponseValidator';
export interface NativeHostedCredential {
	origin: string;
	principalId: string;
	token: string;
}
export interface RemoteHttpOptions {
	origin: string;
	/** Main-process OS-backed session store, never renderer-supplied identity or bearer tokens. */
	credentials: () => Promise<NativeHostedCredential | null>;
	fetch?: typeof fetch;
	authorityVersion?: () => number;
	onDenied?: (principalId: string, projectId?: string) => Promise<void>;
}
function hostedOrigin(value: string): string {
	const url = new URL(value);
	const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (
		(url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
		url.username ||
		url.password ||
		url.pathname !== '/' ||
		url.search ||
		url.hash
	)
		throw new Error('Use an exact HTTPS hosted origin.');
	return url.origin;
}
export class HostedHttpAdapter {
	private origin: string;
	private validator = new RemoteProjectResponseValidator();
	constructor(private options: RemoteHttpOptions) {
		this.origin = hostedOrigin(options.origin);
	}
	async publicStatus(): Promise<unknown> {
		return (
			await this.request('/api/auth/status', { origin: this.origin, principalId: '', token: '' })
		).json();
	}
	async publicJson(path: string, body: unknown): Promise<unknown> {
		const response = await this.request(
			path,
			{ origin: this.origin, principalId: '', token: '' },
			{ method: 'POST', body: JSON.stringify(body) }
		);
		return response.json();
	}
	async authorize(): Promise<NativeHostedCredential> {
		const credential = await this.options.credentials();
		if (
			!credential ||
			credential.origin !== this.origin ||
			!credential.principalId ||
			!credential.token
		) {
			await this.options.onDenied?.(credential?.principalId ?? '');
			throw new Error('A verified hosted session is required.');
		}
		const response = await this.request('/api/auth/status', credential);
		try {
			this.validator.actor(await response.json(), credential.principalId);
		} catch (error) {
			await this.options.onDenied?.(credential.principalId);
			throw error;
		}
		return credential;
	}
	async json(path: string): Promise<unknown> {
		return (await this.request(path, await this.authorize())).json();
	}
	async request(
		path: string,
		credential: NativeHostedCredential,
		init: RequestInit = {},
		publicFailure = false
	): Promise<Response> {
		if (!path.startsWith('/api/') || new URL(path, this.origin).origin !== this.origin)
			throw new Error('Untrusted hosted request path.');
		try {
			const response = await (this.options.fetch ?? fetch)(this.origin + path, {
				...init,
				redirect: 'error',
				signal: AbortSignal.timeout(30000),
				headers: {
					...(credential.token ? { authorization: `Bearer ${credential.token}` } : {}),
					'content-type': 'application/json'
				}
			});
			await this.checkResponse(response, credential, path, publicFailure);
			return response;
		} catch (error) {
			throw HostedFailureValidator.classify(error);
		}
	}
	private async checkResponse(
		response: Response,
		credential: NativeHostedCredential,
		path: string,
		publicFailure: boolean
	) {
		const denied = [401, 403].includes(response.status);
		if (denied)
			await this.options.onDenied?.(
				credential.principalId,
				response.status === 401 ? undefined : /^\/api\/projects\/([^/?]+)/.exec(path)?.[1]
			);
		if (!response.ok)
			throw publicFailure
				? await hostedPublicFailure(response)
				: new HostedFailureValidator(denied ? 'denied' : 'failed', response.status);
	}
}
