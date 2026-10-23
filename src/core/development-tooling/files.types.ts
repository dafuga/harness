export interface PlannedFile {
	path: string;
	contents: string;
}

export type FileWriteStatus = 'created' | 'skipped' | 'overwritten';

export interface FileWriteResult extends PlannedFile {
	status: FileWriteStatus;
}

export interface WriteFilesOptions {
	force?: boolean;
}
