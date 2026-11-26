export type Options = { bun: boolean; fail?: string };

export type Facts = {
	error?: { type: string; message?: string; returncode?: number };
	plistCount: number;
	plist?: {
		label: string;
		calendar: { Hour: number; Minute: number };
		runAtLoad: boolean;
		mode: string;
		args: string[];
		entrypointIsIndex: boolean;
	};
	calls: string[];
};

export type Run = Facts & { stdout: string };
