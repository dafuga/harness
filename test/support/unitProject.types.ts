import type { runHarness } from './cli';

export interface UnitProject {
	root: string;
	write(path: string, contents: string): Promise<void>;
	read(path: string): Promise<string>;
	json<T = Record<string, unknown>>(path: string): Promise<T>;
	harness(args: string[], expectSuccess?: boolean): ReturnType<typeof runHarness>;
	harnessJson<T = Record<string, unknown>>(args: string[]): Promise<T>;
}
