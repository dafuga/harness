import type { PlannedFile } from '../core/files';

export function adapterTypeFiles(): PlannedFile[] {
	return [
		{
			path: 'src/models/adapters/types.ts',
			contents: `export interface PersistenceAdapter {\n\tfind<T>(table: string, id: number): Promise<T | null>;\n\tfindBy<T>(table: string, fields: Record<string, unknown>): Promise<T[]>;\n\tcreate<T>(table: string, input: Record<string, unknown>): Promise<T>;\n\tupdate<T>(table: string, id: number, input: Record<string, unknown>): Promise<T | null>;\n\tdelete(table: string, id: number): Promise<boolean>;\n}\n`
		}
	];
}
