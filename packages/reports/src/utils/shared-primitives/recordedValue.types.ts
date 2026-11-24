// @harness-uid u_brvpiodn4p
/** A bounded reading of already-parsed evidence; original values are never rewritten. */
export type RecordedField = { name: string; node: RecordedNode };

export type RecordedNode =
	| { kind: 'scalar'; type: string; text: string; shortened?: boolean }
	| { kind: 'notice'; text: string }
	| { kind: 'fields'; fields: RecordedField[]; remaining: number }
	| { kind: 'list'; items: RecordedNode[]; remaining: number }
	| { kind: 'table'; columns: string[]; rows: RecordedNode[][]; remaining: number };
