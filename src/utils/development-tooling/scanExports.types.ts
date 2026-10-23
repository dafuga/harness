import type { ExportedSymbol } from '../../core/development-tooling/sourceTypes';
import type { SourceNesting } from './sourceNesting';

export interface ExportScan {
	symbols: ExportedSymbol[];
	errors: string[];
}

export interface Source {
	code: string;
	masked: string;
	nesting: SourceNesting;
}

export interface Located extends ExportedSymbol {
	index: number;
}
