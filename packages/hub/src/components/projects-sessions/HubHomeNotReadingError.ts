// @harness-uid u_ycw5bnre23

/** A message was sent while no signed-in page was reading Home. */
export class HubHomeNotReadingError extends Error {
	constructor() {
		super('Home is not being read.');
		this.name = 'HubHomeNotReadingError';
	}
}
