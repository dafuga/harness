export type Json = Record<string, unknown>;

export interface GithubUserToken {
	accessToken: string;
	expiresIn: number | null;
	refreshToken: string | null;
	refreshExpiresIn: number | null;
}

export interface GithubUser {
	id: number;
	login: string;
}

export interface GithubRepository {
	id: number;
	owner: string;
	name: string;
	private: boolean;
	admin: boolean;
}

export interface InstallationList {
	ids: number[];
	total: number;
}

export interface RepositoryPage {
	repositories: GithubRepository[];
	total: number;
}

export interface InstallationGrant {
	token: string;
	expiresAt: number;
	permissions: Record<string, string>;
	repositories: GithubRepository[];
}
