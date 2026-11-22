// @harness-uid u_h3dg6pr6cs
import type { VaultMethodKind, VaultRecipe } from './vaultRecipe.types';

export type VaultMethod = VaultRecipe['methods'][number];

/** Whether each method can run now; a string is the reason it cannot. */
export type VaultMethodReadiness = Partial<Record<VaultMethodKind, true | string>>;

export type VaultMethodChoice =
	| { status: 'selected'; method: VaultMethod }
	| { status: 'blocked'; kind: VaultMethodKind; reason: string }
	| { status: 'unsupported'; reason: string };
