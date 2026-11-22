// @harness-uid u_ydbpwntlfp
import type { VaultCreated } from '../../services/accounts-access/VaultBrokerService.types';

export interface CredentialRecipeFiles {
	recipe: string;
	review: string;
	/** JSON file `{ "reviewers": [{ "id", "publicKey" }] }` with Ed25519 PEM keys. */
	reviewers: string;
}

export interface CredentialRequestOptions extends CredentialRecipeFiles {
	action: string;
	account?: string;
	item: string;
	session: string;
	project: string;
	environment: string;
	host: string;
	/** The login runner's ephemeral X25519 public key, base64url. */
	runnerKey: string;
	reason: string;
	/** Method kinds that can run now, for example an enrolled API token. */
	ready: string[];
	socket: string;
}

export type CredentialRequestResult =
	| ({ status: 'requested'; method: string; display: string } & VaultCreated)
	| { status: 'blocked' | 'unsupported'; reason: string };
