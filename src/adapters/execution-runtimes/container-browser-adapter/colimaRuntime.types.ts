// @harness-uid u_bav2a24jzh
export interface ColimaRuntimeOptions {
	/** A pre-downloaded VM disk image, so the first start needs no large download. */
	diskImage?: string;
	execute?: (args: string[]) => Promise<void>;
}
