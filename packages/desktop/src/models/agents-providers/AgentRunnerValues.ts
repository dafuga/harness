/** A run that was cancelled by its owner, as distinct from one that failed. */
export class RunCancelled extends Error {
	constructor() {
		super('The run was cancelled.');
		this.name = 'RunCancelled';
	}
}
