import type { AgentRef, ImageBinding, StoredFile } from './Planning.types';
import type { DesignImageInput } from './PlanningBridge.types';

/**
 * Design options: alternatives of one design version, each generated separately. A version
 * written before options holds none and is read as the single design it always was.
 */
export interface DesignOption {
	/** `o1` to `o10`, in the order the options were made; scoped to its version. */
	id: string;
	/** The direction this option was asked to take, unlike the others. */
	direction: string;
	/** The exact prompt its images were generated from, when the caller stated it. */
	prompt: StoredFile | null;
	/** The prompt the image generator reports it used instead; null when it reported none. */
	revisedPrompt: string | null;
	generator: AgentRef;
	/** The files of the version that belong to this option, with their exact hashes. */
	images: ImageBinding[];
}

export interface DesignOptionInput {
	direction: string;
	images: DesignImageInput[];
	/** The exact prompt the images were generated from. */
	prompt?: string;
	revisedPrompt?: string | null;
	/** The image generator of this option; the version's generator when left out. */
	generator?: AgentRef;
}
