export type VitestCase = { fullName?: string; title?: string; status?: string; duration?: number };

export type VitestFile = { name?: string; assertionResults?: VitestCase[] };

export type VitestData = {
	testResults?: VitestFile[];
	numPassedTests?: number;
	numFailedTests?: number;
	numPendingTests?: number;
};
