/** A bounded reading of already-parsed evidence; original values are never rewritten. */
export type RecordedNode =
	| { kind: 'scalar'; type: string; text: string; shortened?: boolean }
	| { kind: 'notice'; text: string }
	| { kind: 'fields'; fields: Array<{ name: string; node: RecordedNode }>; remaining: number }
	| { kind: 'list'; items: RecordedNode[]; remaining: number }
	| { kind: 'table'; columns: string[]; rows: RecordedNode[][]; remaining: number };
