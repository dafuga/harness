import type { ExportedSymbol, SourceFile } from '../../../core/development-tooling/sourceTypes';
import type { SourceReference } from '../../../utils/development-tooling/scanImports';
import type { SourceBlock } from '../../../utils/development-tooling/sourceBlocks';

export interface SourceIndex {
	revision: string;
	/** Indexed files by repository-relative path; ignored files are absent. */
	files: Map<string, SourceFile>;
}
export interface Parsed {
	composition?: SourceFile['composition'];
	execution: NonNullable<SourceFile['execution']>;
	bytes: number;
	lines: number;
	references: SourceReference[];
	blocks: SourceBlock[];
	exports: ExportedSymbol[];
	errors: string[];
	/** False for a file that was not read at all. */
	read: boolean;
	/** True when markup carries a script of its own. */
	scripted: boolean;
}
