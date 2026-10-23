import type { SourceReference } from '../../../utils/development-tooling/scanImports';
import type { ReferenceVia } from '../../../utils/development-tooling/scanImports';

export interface Found extends SourceReference {
	index: number;
}

export interface LiteralPattern {
	via: ReferenceVia;
	pattern: RegExp;
}
