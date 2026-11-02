// @harness-uid u_yipz33fbi6
export interface ConsoleOptions {
	base: string;
	links?: Array<{ label: string; href: string }>;
}

declare global {
	interface Window {
		harnessConsole?: ConsoleOptions;
	}
}
export {};
