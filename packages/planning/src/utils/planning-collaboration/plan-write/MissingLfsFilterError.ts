// @harness-uid u_ohtelrq27t
export class MissingLfsFilterError extends Error {
	constructor() {
		super('No configured LFS filter');
		this.name = 'MissingLfsFilterError';
	}
}
