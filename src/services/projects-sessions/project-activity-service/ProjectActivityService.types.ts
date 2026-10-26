import type { RevisionDetail } from '../../explorer-ui/revision-detail-service/RevisionDetailService';
export type Owners = (path: string) => string[];

export type Reason = { kind: 'reason'; explanation: { unit: string; behavior: string } };

export type RecordedDetail = Pick<RevisionDetail, 'explanations' | 'sourceImpact'> & {
	registry?: { units: Array<{ id: string; owns: { source: string[] } }> };
};
