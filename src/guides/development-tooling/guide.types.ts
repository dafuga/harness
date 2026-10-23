export interface Guide {
	topic: string;
	summary: string;
	steps: string[];
	rules: string[];
	antiPatterns: string[];
	exampleCommands: string[];
	contains?: string[];
}
