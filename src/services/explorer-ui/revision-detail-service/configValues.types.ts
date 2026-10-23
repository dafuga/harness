import type ts from 'typescript';
import type { ConfigVariable } from '../../../utils/explorer-ui/unitMetadata';

export interface ConfigSource {
	file: ts.SourceFile;
	source: string;
	bindings: Map<string, ts.Expression>;
	values: Map<string, ConfigVariable>;
	ancestors: Set<ts.Expression>;
}
