// @harness-uid u_vi67dqgbdy
/** A game.json read or save that the repository refuses: a malformed commit, an oversized document, a stale revision, or a game.json that is not a regular file. */
export class GameDocumentError extends Error {
	override name = 'GameDocumentError';
}
