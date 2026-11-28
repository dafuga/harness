// @harness-uid u_wvk4tojpwk
export interface TrackerHostVolume {
	freeGB: number;
	/** Absent when the filesystem has no fixed inode count. */
	freeInodes?: number;
	inodeFreePercent?: number;
}

/** Live readings of the computer that would run a launch. */
export interface TrackerHostResources {
	cores(): number;
	/** One- and five-minute load averages. */
	load(): readonly [number, number];
	/** freePercent is null when the operating system could not report it. */
	memory(): { availableMB: number; freePercent: number | null };
	/** Throws when the filesystem cannot be read. */
	volume(path: string): TrackerHostVolume;
}

export interface TrackerHostResourceLimits {
	minAvailableMemMB?: number;
	minFreeDiskGB?: number;
}

export interface TrackerHostResourceRequest {
	node: string;
	/** Filesystems the launch writes to. The first is the home volume. */
	paths: readonly string[];
	limits: TrackerHostResourceLimits;
}
