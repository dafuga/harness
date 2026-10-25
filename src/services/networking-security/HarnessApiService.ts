import type { ApiSnapshot, HarnessApiOptions } from './HarnessApiService.types';
import type { ApiResponse } from '../../adapters/networking-security/HarnessHttpAdapter.types';
import { HarnessHttpAdapter } from '../../adapters/networking-security/HarnessHttpAdapter';
import { ApiSessionRepository } from './harness-api-service/ApiSessionRepository';
import { fail } from '../../core/development-tooling/errors';

/** Maps app operations to the selected local console or hosted project API. */
export class HarnessApiService {
	readonly http: HarnessHttpAdapter;
	readonly project: string | undefined;
	readonly hosted: boolean;
	private sessions: ApiSessionRepository;
	constructor(readonly options: HarnessApiOptions = {}) {
		this.project = options.project ?? apiEnvironment('HARNESS_API_PROJECT');
		const tokenEnv = options.tokenEnv ?? 'HARNESS_API_TOKEN';
		if (!/^[A-Z_][A-Z0-9_]*$/i.test(tokenEnv))
			fail('Supply the name of a token environment variable.');
		const connection = {
			url: options.url ?? apiEnvironment('HARNESS_API_URL') ?? 'http://127.0.0.1:5690',
			timeout: apiTimeout(options.timeout)
		};
		this.http = new HarnessHttpAdapter(connection);
		this.hosted = hostedMode(options.mode, this.project, this.http.local);
		if (!this.hosted && !this.http.local) fail('Local API sessions require a loopback server.');
		if (this.hosted)
			this.http = new HarnessHttpAdapter({ ...connection, token: process.env[tokenEnv] });
		this.sessions = new ApiSessionRepository(this.http.origin);
	}
	async connect(): Promise<{ connected: true; server: string }> {
		if (this.hosted) {
			await this.http.request('GET', '/api/projects');
		} else {
			await this.sessions.save(await this.createSession());
		}
		return { connected: true, server: this.http.origin };
	}
	private async createSession(): Promise<string> {
		const result = await this.http.request('POST', '/api/agent', { input: { method: 'connect' } });
		const token = (result.data as { token?: unknown })?.token;
		if (typeof token !== 'string' || !token) fail('The local API returned no session.');
		return token;
	}
	async snapshot(): Promise<ApiSnapshot> {
		const input = { branch: this.options.branch ?? null, commit: this.options.commit ?? null };
		return (await this.read('snapshot', input)).data as ApiSnapshot;
	}
	async read(resource: string, input: Record<string, unknown> = {}): Promise<ApiResponse> {
		if (!this.hosted) return this.local(resource, input);
		if (resource === 'projects') return this.http.request('GET', '/api/projects');
		return this.http.request('GET', this.projectPath(resource), {
			query: Object.entries(input)
				.filter((entry) => entry[1] !== null && entry[1] !== undefined)
				.map(([key, field]) => [key, String(field)])
		});
	}
	async call(
		method: string,
		input: Record<string, unknown>,
		requestId?: string
	): Promise<ApiResponse> {
		const body: Record<string, unknown> = { method, input, ...(requestId ? { requestId } : {}) };
		if (['createPlan', 'startRun', 'approve', 'openThread'].includes(method)) {
			const snapshot = await this.snapshot();
			if (!snapshot.writable || !snapshot.revision.atTip || this.options.commit)
				fail('Agent writes require the writable branch tip, not a historical commit.');
			body.revision = snapshot.revision;
		}
		if (!this.hosted) return this.local(method, input, requestId);
		return this.http.request('POST', this.projectPath('agent'), { input: body });
	}
	private projectPath(resource: string): string {
		if (!this.project) fail('Select a hosted project with --project or HARNESS_API_PROJECT.');
		return `/api/projects/${encodeURIComponent(this.project)}/${encodeURIComponent(resource)}`;
	}
	private async local(
		method: string,
		input: Record<string, unknown>,
		requestId?: string
	): Promise<ApiResponse> {
		const token = await this.sessions.ensure(() => this.createSession());
		return this.http.request('POST', '/api/agent', {
			token,
			input: { method, input, ...(requestId ? { requestId } : {}) }
		});
	}
}

function apiEnvironment(name: string): string | undefined {
	const configured = process.env[name];
	return configured?.length ? configured : undefined;
}

function hostedMode(
	mode: HarnessApiOptions['mode'],
	project: string | undefined,
	local: boolean
): boolean {
	if (mode && !['local', 'hosted'].includes(mode)) fail('API mode must be local or hosted.');
	return mode === 'hosted' || (!mode && (!!project || !local));
}

function apiTimeout(text?: string): number {
	const timeout = text === undefined ? 30000 : Number(text);
	if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 3600000)
		fail('API timeout must be an integer between 1 and 3600000 milliseconds.');
	return timeout;
}
