// @harness-uid u_wwerrde2nk
import type { SearchPattern } from '../../../core/development-tooling/bug-class/bugClassSchemas.types';

export interface PatternHit {
	line: number;
	pattern: SearchPattern;
}
