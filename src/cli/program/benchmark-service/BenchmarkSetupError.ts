// @harness-uid u_4ygkfoscxo
export class BenchmarkSetupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BenchmarkSetupError';
	}
}
