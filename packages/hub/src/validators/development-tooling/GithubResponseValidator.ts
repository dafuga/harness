type Json = Record<string, unknown>;

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

const TOKEN = /^[A-Za-z0-9_.~+/=-]{1,4096}$/;
const LOGIN = /^[A-Za-z0-9_-]{1,100}(?:\[bot\])?$/;
const OWNER = /^[a-zA-Z0-9-]{1,100}$/;
const NAME = /^[a-zA-Z0-9_.-]{1,100}$/;

const object = (value: unknown): Json | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
const positive = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const text = (value: unknown, pattern: RegExp): value is string =>
	typeof value === 'string' && pattern.test(value);
const optional = <T>(value: unknown, valid: (value: unknown) => value is T): T | null =>
	valid(value) ? value : null;
const token = (value: unknown): value is string => text(value, TOKEN);

function total(json: Json, fallback: number): number {
	return positive(json.total_count) ? json.total_count : fallback;
}

function permissionMap(value: unknown): Record<string, string> | null {
	const entries = Object.entries(object(value) ?? { invalid: null });
	const valid = entries.every(([, level]) => typeof level === 'string');
	return valid ? (Object.fromEntries(entries) as Record<string, string>) : null;
}

/** Reads only the members the hub relies on from a GitHub payload. Null means "not proven". */
export class GithubResponseValidator {
	userToken(value: unknown): GithubUserToken | null {
		const json = object(value);
		if (!json || 'error' in json || !token(json.access_token)) return null;
		if (String(json.token_type).toLowerCase() !== 'bearer') return null;
		return {
			accessToken: json.access_token,
			expiresIn: optional(json.expires_in, positive),
			refreshToken: optional(json.refresh_token, token),
			refreshExpiresIn: optional(json.refresh_token_expires_in, positive)
		};
	}

	user(value: unknown): GithubUser | null {
		const json = object(value);
		if (!json || !positive(json.id) || !text(json.login, LOGIN)) return null;
		return { id: json.id, login: json.login };
	}

	/** `admin` is true only for a literal `permissions.admin === true`. */
	repository(value: unknown): GithubRepository | null {
		const json = object(value);
		const owner = object(json?.owner)?.login;
		if (!json || !positive(json.id) || typeof json.private !== 'boolean') return null;
		if (!text(owner, OWNER) || !text(json.name, NAME) || /^\.+$/.test(json.name)) return null;
		const admin = object(json.permissions)?.admin === true;
		return { id: json.id, owner, name: json.name, private: json.private, admin };
	}

	/** Installations of this app that are not suspended. */
	installations(value: unknown, appId: number): InstallationList | null {
		const json = object(value);
		if (!json || !Array.isArray(json.installations)) return null;
		const rows = json.installations.map(object).filter((row) => row !== null);
		const live = rows.filter((row) => row.app_id === appId && (row.suspended_at ?? null) === null);
		const ids = live.map((row) => row.id).filter(positive);
		return { ids, total: total(json, json.installations.length) };
	}

	repositories(value: unknown): RepositoryPage | null {
		const json = object(value);
		if (!json || !Array.isArray(json.repositories)) return null;
		const repositories = json.repositories
			.map((item) => this.repository(item))
			.filter((item) => item !== null);
		return { repositories, total: total(json, json.repositories.length) };
	}

	installationGrant(value: unknown): InstallationGrant | null {
		const json = object(value);
		const permissions = permissionMap(json?.permissions);
		const expiresAt = Date.parse(typeof json?.expires_at === 'string' ? json.expires_at : '');
		if (!json || !token(json.token) || !permissions || !Number.isFinite(expiresAt)) return null;
		if (!Array.isArray(json.repositories)) return null;
		const repositories = json.repositories.map((item) => this.repository(item));
		if (repositories.some((item) => item === null)) return null;
		const complete = repositories.filter((item) => item !== null);
		return { token: json.token, expiresAt, permissions, repositories: complete };
	}
}
