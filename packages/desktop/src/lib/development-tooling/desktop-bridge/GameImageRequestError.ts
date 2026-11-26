// @harness-uid u_semfvbq3vk
/** A game-image request refused for its checkpoint, view, revision, prompt length or busy game. */
export class GameImageRequestError extends Error {
	override name = 'GameImageRequestError';
}
