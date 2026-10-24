export const htmlElements: string[];
export const svgElements: string[];
export const inputTypes: string[];
export const voidElements: Set<string>;
export function elementName(tag: string): string;
export const nativeAtoms: Array<{ name: string; tag: string; type?: string }>;
export function atomTag(atom: { name: string }): string;
export function nativeAtomSource(atom: { tag: string; type?: string }): string;
