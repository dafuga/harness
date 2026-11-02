// @harness-uid u_64mql5f5ei
import type { FileWriteResult, FileWriteStatus } from './files.types';

export function renderFileList(files: FileWriteResult[]): string {
	return files.map((file) => `  ${statusLabel(file.status)} ${file.path}`).join('\n');
}

function statusLabel(status: FileWriteStatus): string {
	if (status === 'created') {
		return 'create';
	}

	if (status === 'overwritten') {
		return 'overwrite';
	}

	return 'skip';
}
