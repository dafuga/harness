// @harness-uid u_ocykouvtlq
/** A harness artifact that cannot be read, named or served; its code property gives the reason. */
export { HarnessArtifactUnavailableError } from './HarnessArtifactUnavailableError';

export type HubJsonValue =
	| null
	| boolean
	| number
	| string
	| HubJsonValue[]
	| { [key: string]: HubJsonValue };
