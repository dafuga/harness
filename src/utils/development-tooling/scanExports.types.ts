// @harness-uid u_vkx5vqjo6s
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
	allowBareUndefined: boolean;
}

export interface Located extends ExportedSymbol {
	index: number;
}
