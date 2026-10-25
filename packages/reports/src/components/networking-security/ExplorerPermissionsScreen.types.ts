import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
export interface ExplorerPermissionsScreenProps extends ExplorerScreenProps {
	/** Restricts the screen to the API access every profile declares for this endpoint unit ID. */
	endpoint?: string;
}
type Catalog = NonNullable<ExplorerScreenProps['head']['permissions']>;
/** One declared profile of the selected revision, with the file that declares it. */
export type ProfileEntry = Catalog['profiles'][number];
export type ProfileGrant = ProfileEntry['grants'][number];
export type ApiGrant = Extract<ProfileGrant, { kind: 'api' }>;
export type DataGrant = ApiGrant['data'][number];
