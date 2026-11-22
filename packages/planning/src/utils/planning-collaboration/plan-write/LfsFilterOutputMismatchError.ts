// @harness-uid u_ohtelrq27t
export class LfsFilterOutputMismatchError extends Error {
	constructor() {
		super('Configured filter did not produce an LFS pointer');
		this.name = 'LfsFilterOutputMismatchError';
	}
}
