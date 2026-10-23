import type ts from 'typescript';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';

export type Edit = { start: number; end: number; text: string };

export type Callable =
	| ts.FunctionDeclaration
	| ts.ArrowFunction
	| ts.FunctionExpression
	| ts.MethodDeclaration;

export interface Context {
	file: ts.SourceFile;
	unit: ComponentManifest;
	watch: string;
	method: string;
	edits: Edit[];
}
