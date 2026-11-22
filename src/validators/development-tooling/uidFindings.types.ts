// @harness-uid u_hbdc5y2sd2
export interface UidFinding {
	unit: string;
	kind: 'uid-missing' | 'uid-mismatch' | 'uid-duplicate' | 'uid-copied';
	detail: string;
	where: string;
}
