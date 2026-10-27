import type { ApprovalInfo, Region } from '../development-tooling/Desktop.types';

/** One image of a design version; `option` names the design option holding it, when it has one. */
export interface DesignImage {
	/** The exact path within the version directory, required for revision-bound reads. */
	file: string;
	state: string;
	viewport: string;
	sha256: string;
	bytes: number;
	option?: string;
}

/** A separately generated alternative of a version: its direction, prompts and images. */
export interface DesignOptionInfo {
	/** `o1` to `o10`, within its version. */
	id: string;
	direction: string;
	/** The exact prompt its image was generated from, when one was stated. */
	prompt: string | null;
	/** The prompt the image generator reports it used instead. */
	revisedPrompt: string | null;
	generator: string;
	imageHashes: string[];
}

/** The exact earlier image a version revises, and the thread and rectangle it came from. */
export interface DesignRevision {
	version: string;
	imageSha256: string;
	option?: string;
	region: Region | null;
	threadId: string | null;
}

export interface DesignVersion {
	version: string;
	createdAt: string;
	/** The commit that contains the version, derived from Git; null when not found. */
	commit: string | null;
	generator: string;
	prompt: string;
	notes?: string;
	baseRevision: string;
	images: DesignImage[];
	approval: ApprovalInfo | null;
	/** Its design options; a single design has none. */
	options?: DesignOptionInfo[];
	/** The image it revises, for a before and after of exactly that image. */
	revises?: DesignRevision | null;
}
