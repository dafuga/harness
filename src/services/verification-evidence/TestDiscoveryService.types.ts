export interface DiscoveredTest {
	file: string;
	title: string;
	line: number;
	dynamic: boolean;
	disabled: boolean;
}
export interface TestDiscovery {
	tests: DiscoveredTest[];
	errors: string[];
}
