// @harness-uid u_txyftyntj5
export class ReadOnlyAgentChangedFilesError extends Error {
	constructor() {
		super('The read-only agent changed files. Changes were preserved for review.');
		this.name = 'ReadOnlyAgentChangedFilesError';
	}
}
