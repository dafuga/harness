// @harness-uid u_rw64iex44n
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type {
	TaskRunInput,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { resourceHome } from '../../../utils/execution-runtimes/resourceConfig';
import { hardContextTokens, providerCompactionTokens } from './sessionPolicy';

export type CodexTaskSelection = TaskSelection &
	Partial<Pick<TaskRunInput, 'images' | 'cwd' | 'platform'>>;

/**
 * Codex gets the same brief and the same working commands as Claude: no user configuration or
 * project instructions beyond the task prompt, and a sandbox that still confines writes to the
 * task worktree but lets the repository's own test, lint and Git commands run inside it.
 */
export function codexTaskCommand(selection: CodexTaskSelection): string[] {
	return [
		'codex',
		'exec',
		'--json',
		'--ignore-user-config',
		'--sandbox',
		'workspace-write',
		'-m',
		selection.model,
		'-c',
		`model_reasoning_effort=${JSON.stringify(selection.intelligence)}`,
		'-c',
		'model_provider="openai"',
		'-c',
		'approval_policy="never"',
		'-c',
		`model_context_window=${hardContextTokens}`,
		'-c',
		`model_auto_compact_token_limit=${providerCompactionTokens}`,
		'-c',
		'tool_output_token_limit=12000',
		'-c',
		'project_doc_max_bytes=0',
		'-c',
		'sandbox_workspace_write.network_access=true',
		'-c',
		`sandbox_workspace_write.writable_roots=${JSON.stringify(codexWritableRoots(selection))}`,
		...(selection.images ?? []).flatMap((path) => ['-i', path]),
		'-'
	];
}

/**
 * Paths outside the worktree that repository commands write: the worktree's own Git state
 * (index and HEAD, never the shared object store) and the machine's resource queue.
 */
export function codexWritableRoots(
	selection: Pick<CodexTaskSelection, 'cwd' | 'platform'>,
	env: Record<string, string | undefined> = process.env
): string[] {
	if (selection.platform === 'linux' || !selection.cwd) return [];
	return [worktreeGitDirectory(selection.cwd), resourceHome(env)].filter(
		(path): path is string => path !== undefined && existsSync(path)
	);
}

function worktreeGitDirectory(cwd: string): string | undefined {
	const pointer = join(cwd, '.git');
	if (!statSync(pointer, { throwIfNoEntry: false })?.isFile()) return undefined;
	const target = /^gitdir: (.+)$/m.exec(readFileSync(pointer, 'utf8'))?.[1]?.trim();
	if (!target) return undefined;
	return isAbsolute(target) ? target : resolve(cwd, target);
}
