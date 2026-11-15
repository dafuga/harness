import type { EntityEvidenceQuery } from '../../../desktop/src/models/verification-evidence/DesktopEvidence.types';
import type { evidenceFixture } from './evidenceFixture';

export type EvidenceFixture = ReturnType<typeof evidenceFixture>;

export type Mode = EntityEvidenceQuery['mode'];

export type Asked = Omit<EntityEvidenceQuery, 'projectId'> & { projectId: string };
