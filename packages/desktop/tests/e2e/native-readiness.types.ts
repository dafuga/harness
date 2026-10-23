/** What a native capture must show before any pixels of it are recorded. */
export interface NativeExpected {
	state: 'draft' | 'design' | 'approved' | 'history';
	unitId: string;
	/** The commit the Commit picker must show: the tip, or the historical commit opened. */
	commit: string;
}
