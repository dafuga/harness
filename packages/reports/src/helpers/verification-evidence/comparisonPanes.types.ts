/** One revision owns its content, source identity and any stated evidence gap. */
export interface ComparisonSide<T> {
	value?: T;
	commit?: string | null;
	key?: string;
	gap?: string;
	currentLabel?: string;
	currentRole?: string;
}

/** Rendering context passed intact to the side's content and metadata slots. */
export interface ComparisonPane<T> {
	key: string;
	side: 'before' | 'after';
	phase: 'before' | 'after' | 'current';
	commit: string;
	heading: string;
	role: string;
	value: T | undefined;
	gap: string | undefined;
}
