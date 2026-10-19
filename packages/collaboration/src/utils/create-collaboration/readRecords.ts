import type {
	CollaborationDependencies,
	CollaborationRecords
} from '../../models/Collaboration.types';
import { parse } from '../parseCollaborationInput';
import { recordsSchema } from '../recordsSchema';

export async function readRecords(deps: CollaborationDependencies): Promise<CollaborationRecords> {
	return parse(recordsSchema, (await deps.repository.read()).records);
}
