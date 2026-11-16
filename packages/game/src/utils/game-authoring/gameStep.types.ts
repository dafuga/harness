// @harness-uid u_2cx5yuvuut
/** A game step refused because its level is not approved and built, a movement delta is not finite, or a mechanic patch writes a duplicate or unsafe state key. */
export class GameStepRefusedError extends Error {
	override name = 'GameStepRefusedError';
}
