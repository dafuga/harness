import type { DesignImageInput } from '../../models/planning-collaboration/PlanningBridge.types';
import type { DesignImage } from '../../models/planning-collaboration/Planning.types';

/** Writes the images of a design with each file name under `prefix`, answering what it wrote. */
export type WriteImages = (images: DesignImageInput[], prefix: string) => DesignImage[];
