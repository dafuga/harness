// @harness-uid u_5q7ojstspr
export class InvalidCleanupTimeError extends Error {
	constructor() {
		super('Invalid cleanup time');
		this.name = 'InvalidCleanupTimeError';
	}
}
