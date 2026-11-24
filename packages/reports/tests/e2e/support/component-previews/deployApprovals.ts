import { approvalCardFixture } from '../../../../../../test/support/scripted-deploy/approvalCardFixture';

export const approvalsPage = 'desktop.page.development-tooling-deploy-approvals';
export const approvalCard = 'desktop.component.development-tooling-deploy-approval-card';

export const pendingApproval = {
	...approvalCardFixture(Date.UTC(2030, 0, 15, 12, 5)),
	receipt: null,
	used: false
};
export const approvalCardProps = {
	card: pendingApproval,
	status: 'Pending',
	disabled: false,
	error: '',
	decide: () => {},
	close: () => {}
};
