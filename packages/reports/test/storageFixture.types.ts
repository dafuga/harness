export interface FixtureCloud {
	objects: Map<string, Buffer>;
	failDelete?: boolean;
	calls: string[];
}
