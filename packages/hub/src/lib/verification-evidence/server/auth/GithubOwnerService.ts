import type { Actor, RepositoryIdentity } from 'collaboration';
import type { GithubApiAdapter } from './GithubApiAdapter';
import type {
	GithubRepositories,
	GithubRepositoryOption
} from '../../../../models/accounts-access/HubAuth.types';
import { authFail } from '../../../../utils/accounts-access/authFail';
import type { GithubGrantService } from './GithubGrantService';
import type { InstallationTokenService } from './installation-token-service/InstallationTokenService';

export interface GithubOwnerOptions {
	grants: GithubGrantService;
	tokens: InstallationTokenService;
	api: GithubApiAdapter;
	appId: number;
}

const MAX_INSTALLATIONS = 10;
const MAX_PAGES = 3;
const PAGE_SIZE = 100;

/**
 * Proves, live, that a connected GitHub user administers a repository the app is installed on.
 * Nothing the client sends is used as proof: no installation id, owner or name is accepted.
 */
export class GithubOwnerService {
	constructor(private readonly options: GithubOwnerOptions) {}

	/**
	 * 1. The user's own token lists the app installations that user can reach.
	 * 2. GitHub, asked as the app, says which of those holds the repository id.
	 * 3. The user's own token must show `admin` on that exact repository.
	 */
	async authorizeRepository(actor: Actor, repositoryId: number): Promise<RepositoryIdentity> {
		if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
			return authFail('repository-denied');
		}
		const token = await this.options.grants.userToken(actor);
		for (const installationId of await this.installations(token)) {
			const identity = await this.options.tokens.resolve(installationId, repositoryId);
			if (!identity) continue;
			const admin = await this.administers(token, identity);
			return admin ? identity : authFail('repository-denied');
		}
		return authFail('repository-denied');
	}

	/** Repositories the connected user administers and the app can reach, for the picker. */
	async repositories(actor: Actor): Promise<GithubRepositories> {
		const token = await this.options.grants.userToken(actor);
		const list = await this.options.api.installations(token, this.options.appId);
		const ids = list?.ids ?? [];
		const repositories: GithubRepositoryOption[] = [];
		let truncated = ids.length > MAX_INSTALLATIONS || (list?.total ?? 0) > PAGE_SIZE;
		for (const installationId of ids.slice(0, MAX_INSTALLATIONS)) {
			const more = await this.collect(token, installationId, repositories);
			truncated = truncated || more;
		}
		return { repositories, truncated };
	}

	private async installations(token: string): Promise<number[]> {
		const list = await this.options.api.installations(token, this.options.appId);
		return (list?.ids ?? []).slice(0, MAX_INSTALLATIONS);
	}

	private async administers(token: string, identity: RepositoryIdentity): Promise<boolean> {
		const live = await this.options.api.repository(token, identity);
		return live !== null && live.id === identity.id && live.admin;
	}

	/** Reads a bounded number of pages. True when the installation holds more than was read. */
	private async collect(
		token: string,
		installationId: number,
		found: GithubRepositoryOption[]
	): Promise<boolean> {
		for (let page = 1; page <= MAX_PAGES; page++) {
			const result = await this.options.api.installationRepositories(token, installationId, page);
			if (!result) return false;
			for (const repository of result.repositories.filter((item) => item.admin)) {
				const { id, owner, name } = repository;
				found.push({ id, owner, name, private: repository.private });
			}
			if (page * PAGE_SIZE >= result.total) return false;
		}
		return true;
	}
}
