// @harness-uid u_ohtelrq27t
export class MissingLfsFilterError extends Error {
	constructor() {
		super('No configured LFS filter');
		this.name = 'MissingLfsFilterError';
	}
}

export class LfsFilterOutputMismatchError extends Error {
	constructor() {
		super('Configured filter did not produce an LFS pointer');
		this.name = 'LfsFilterOutputMismatchError';
	}
}
