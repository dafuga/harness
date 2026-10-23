export interface Statement {
	all(...args: (string | number)[]): unknown[];
	get(...args: (string | number)[]): unknown;
	run(...args: (string | number)[]): unknown;
}

export interface ResourceDatabase {
	exec(sql: string): unknown;
	query(sql: string): Statement;
	close(): void;
}
