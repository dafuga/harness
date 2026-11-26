import type { GithubAppJwtInput } from '../../src/utils/verification-evidence/githubAppJwt';

export type Sample = Pick<GithubAppJwtInput, 'appId' | 'now'>;

export type KeyPair = { pkcs1: string; pkcs8: string; publicKey: string };
