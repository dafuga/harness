export interface ConsoleOptions {
	base: string;
	exportable?: boolean;
	links?: Array<{ label: string; href: string }>;
}

declare global {
	interface Window {
		harnessConsole?: ConsoleOptions;
	}
}
export {};
