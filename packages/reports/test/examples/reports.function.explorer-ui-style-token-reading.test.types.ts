export type Decls = Record<string, string>;

export type RuleData =
	| { selector: string; decls: Decls }
	| { imports: SheetData }
	| { group: RuleData[] };

export type SheetData = { crossOrigin: true } | { rules: RuleData[] };

export interface Sheet {
	cssRules: unknown[];
}
