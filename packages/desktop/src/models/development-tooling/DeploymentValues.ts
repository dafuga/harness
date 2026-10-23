export const deploymentEnvironments = ['dev', 'stage', 'preprod', 'prod'] as const;
export const deploymentSteps = [
	{ id: 'preparing', title: 'Prepare source' },
	{ id: 'checking', title: 'Run checks' },
	{ id: 'building', title: 'Build source' },
	{ id: 'uploading', title: 'Deploy to Cloudflare' },
	{ id: 'verifying', title: 'Verify health' }
] as const;
