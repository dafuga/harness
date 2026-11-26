// @harness-uid u_2rustlmo6g
/** A scope read refused: its commit is no longer the tip, or its entity is not registered. */
export class RefusedScopeError extends Error {
	override name = 'RefusedScopeError';
}
