export interface Repo {
	root: string;
	git: (...args: string[]) => string;
}
