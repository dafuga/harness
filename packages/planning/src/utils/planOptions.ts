import type { DesignImageInput } from '../models/PlanningBridge.types';
import type { AgentRef, DesignImage, DesignVersion, ImageBinding } from '../models/Planning.types';
import { text } from './planValidate';

/** Writes the images of a design with each file name under `prefix`, answering what it wrote. */
export type WriteImages = (images: DesignImageInput[], prefix: string) => DesignImage[];

export const most = 10;

export const id = (at: number) => `o${at + 1}`;

export const binding = ({ file, sha256 }: ImageBinding): ImageBinding => ({ file, sha256 });

export function provenance(generator: AgentRef): AgentRef {
	text(generator?.provider);
	text(generator.model);
	return { provider: generator.provider, model: generator.model };
}

/** The option of a version that holds this file; undefined in a single design. */
export function optionOf(version: DesignVersion, file: string): string | undefined {
	return version.options?.find((option) => option.images.some((image) => image.file === file))?.id;
}

/** What approving `option` binds: that option's images, or every image of a single design. */
export function approvable(version: DesignVersion, option?: string): ImageBinding[] | null {
	if (!version.options) return option === undefined ? version.images.map(binding) : null;
	return version.options.find((item) => item.id === option)?.images ?? null;
}

export { planOptions } from '../services/planning-service/planOptions';
export { checkOptions } from './plan-read/planOptions';
export { heldBy } from './plan-design/planOptions';
