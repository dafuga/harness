/** One stored object; R2 objects have this shape. */
export interface ConsoleObject {
	text(): Promise<string>;
	arrayBuffer(): Promise<ArrayBuffer>;
}

/** The part of a private object store the console reads; an R2 bucket binding satisfies it. */
export interface ConsoleBucket {
	get(key: string): Promise<ConsoleObject | null>;
}
