import type { RepositoryIdentity } from 'collaboration';
import type { GithubApiAdapter, InstallationScope } from '../../adapters/GithubApiAdapter';
import type { InstallationTokenInput } from '../../models/HubAuth.types.ts';
import type { GithubAppConfig } from '../../utils/authConfig';
import { authFail } from '../../utils/authFail';
import { githubAppJwt, githubAppKey } from './githubAppJwt';
import type { InstallationGrant } from '../../validators/GithubResponseValidator';

export interface CachedInstallationToken {
	token: string;
	expiresAt: number;
}

export interface InstallationTokenOptions {
	app: GithubAppConfig;
	api: GithubApiAdapter;
	/** Isolate memory only. Tokens are never written to a store. */
	cache: Map<string, CachedInstallationToken>;
	now: () => number;
}

const REFRESH_MARGIN = 5 * 60 * 1000;

const MAX_REPOSITORIES = 10;

const MAX_CACHED = 256;

const ascending = (left: number, right: number) => left - right;

const positive = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function repositoryList(ids: unknown): ids is number[] {
	if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_REPOSITORIES) return false;
	return ids.every(positive) && new Set(ids).size === ids.length;
}

/** One permission, `contents`, at `read` or `write`. Anything else is not a request we make. */
function wellFormed(input: InstallationTokenInput): boolean {
	const names = Object.keys(Object(input.permissions));
	if (names.length !== 1 || names[0] !== 'contents') return false;
	if (!['read', 'write'].includes(input.permissions.contents)) return false;
	return positive(input.installationId) && repositoryList(input.repositoryIds);
}

/** GitHub must grant exactly the repositories and permissions asked for, plus metadata read. */
function exact(grant: InstallationGrant, scope: InstallationScope): boolean {
	const granted = grant.repositories.map((repository) => repository.id).sort(ascending);
	const asked = [...scope.repository_ids].sort(ascending);
	const wanted: Record<string, string> = { metadata: 'read', ...scope.permissions };
	const nothingExtra = Object.keys(grant.permissions).every(
		(name) => grant.permissions[name] === wanted[name]
	);
	const nothingMissing = Object.keys(scope.permissions).every(
		(name) => grant.permissions[name] === scope.permissions[name]
	);
	return granted.join() === asked.join() && nothingExtra && nothingMissing;
}

/** Mints repository-scoped installation tokens as the GitHub App. Never reachable over HTTP. */
export class InstallationTokenService {
	private key: Promise<CryptoKey> | undefined;

	constructor(private readonly options: InstallationTokenOptions) {}

	async token(input: InstallationTokenInput): Promise<string> {
		if (!wellFormed(input) || !this.permitted(input)) return authFail('token-scope-denied');
		const level = input.permissions.contents;
		const ids = [...input.repositoryIds].sort(ascending);
		const key = [this.options.app.appId, input.installationId, level, ids.join(',')].join(':');
		const cached = this.options.cache.get(key);
		if (cached && cached.expiresAt - REFRESH_MARGIN > this.options.now()) return cached.token;
		const scope = { repository_ids: ids, permissions: { contents: level } };
		const grant = await this.mint(input.installationId, scope);
		if (!grant) return authFail('repository-denied');
		if (!exact(grant, scope)) return authFail('token-scope-denied');
		this.remember(key, grant);
		return grant.token;
	}

	/**
	 * Asks GitHub whether this installation holds this repository, with a metadata-only token
	 * that is then dropped. The identity returned is GitHub's, not the caller's.
	 */
	async resolve(installationId: number, repositoryId: number): Promise<RepositoryIdentity | null> {
		const scope = { repository_ids: [repositoryId], permissions: { metadata: 'read' } };
		const grant = await this.mint(installationId, scope);
		if (!grant || !exact(grant, scope)) return null;
		const [found] = grant.repositories;
		return {
			id: found.id,
			owner: found.owner,
			name: found.name,
			private: found.private,
			installationId
		};
	}

	/** Write goes to the configured collaboration repository on its installation, nowhere else. */
	private permitted(input: InstallationTokenInput): boolean {
		if (input.permissions.contents === 'read') return true;
		const target = this.options.app.collaboration;
		const [only, ...rest] = input.repositoryIds;
		if (!target || rest.length > 0 || only !== target.repositoryId) return false;
		return input.installationId === target.installationId;
	}

	private async mint(
		installationId: number,
		scope: InstallationScope
	): Promise<InstallationGrant | null> {
		const { app, api, now } = this.options;
		this.key ??= githubAppKey(app.privateKey);
		const jwt = await githubAppJwt({ appId: app.appId, key: await this.key, now: now() });
		return api.installationToken(jwt, installationId, scope);
	}

	private remember(key: string, grant: InstallationGrant): void {
		const { cache, now } = this.options;
		for (const [name, entry] of cache) if (entry.expiresAt <= now()) cache.delete(name);
		if (cache.size >= MAX_CACHED) cache.clear();
		cache.set(key, { token: grant.token, expiresAt: grant.expiresAt });
	}
}
