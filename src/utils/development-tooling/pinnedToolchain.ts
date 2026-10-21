/** A pinned tool and its child environment. */
export interface PinnedTool {
	command: string;
	env: Record<string, string | undefined>;
}

/** Tool selection, including launch failures. */
export interface ToolAnswer {
	status: number | null;
	stdout: string;
	stderr: string;
	failed: boolean;
}

export type ToolRun = (
	command: string,
	args: string[],
	cwd: string,
	env: PinnedTool['env']
) => ToolAnswer;

export interface PinnedOptions {
	/** Read the nearest rust-toolchain.toml from this directory upwards. */
	cwd?: string;
	env?: Record<string, string | undefined>;
	run?: ToolRun;
}

export { pinnedToolchain } from '../../../scripts/build-kernel/pinnedToolchain';
