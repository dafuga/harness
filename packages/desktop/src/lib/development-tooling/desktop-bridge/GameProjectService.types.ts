// @harness-uid u_2kfhf7xn2l
export class GameProjectBusyError extends Error {
	override name = 'GameProjectBusyError';
}

export class GameProjectAlreadyExistsError extends Error {
	override name = 'GameProjectAlreadyExistsError';
}
