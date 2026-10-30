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
