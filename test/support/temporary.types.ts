export interface TemporaryRepo {
	root: string;
	git: (...args: string[]) => string;
}
