import type {
	CollaborationDependencies,
	CollaborationRecords
} from '../../../models/planning-collaboration/Collaboration.types';
import { parse } from '../../planning-collaboration/parseCollaborationInput';
import { recordsSchema } from '../../development-tooling/recordsSchema';

export async function readRecords(deps: CollaborationDependencies): Promise<CollaborationRecords> {
	return parse(recordsSchema, (await deps.repository.read()).records);
}
