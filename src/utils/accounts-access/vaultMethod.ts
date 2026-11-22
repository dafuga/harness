// @harness-uid u_h3dg6pr6cs
import type { VaultMethodKind, VaultRecipe } from './vaultRecipe.types';
import type { VaultMethodChoice, VaultMethodReadiness } from './vaultMethod.types';

/** The fixed preference order: provider tokens, then device grants, then a browser login. */
export const vaultMethodOrder: readonly VaultMethodKind[] = [
	'api-token',
	'oauth-device',
	'browser'
];

/**
 * Picks the method for an action. The first declared method in the fixed order is the only
 * candidate: when it is not ready the request is blocked and never moves on to a browser login.
 */
export function vaultMethod(
	recipe: VaultRecipe,
	action: string,
	readiness: VaultMethodReadiness
): VaultMethodChoice {
	if (!recipe.actions.some(({ id }) => id === action)) {
		return { status: 'unsupported', reason: 'The recipe declares no action ' + action + '.' };
	}
	for (const kind of vaultMethodOrder) {
		const method = recipe.methods.find(
			(entry) => entry.kind === kind && entry.actions.includes(action)
		);
		if (!method) continue;
		const ready = readiness[kind];
		if (ready === true) return { status: 'selected', method };
		return { status: 'blocked', kind, reason: ready ?? 'The ' + kind + ' method is not ready.' };
	}
	return { status: 'unsupported', reason: 'No method of the recipe covers ' + action + '.' };
}
