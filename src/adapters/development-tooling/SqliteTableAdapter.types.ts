// @harness-uid u_3fffcewbke

export { PrimaryKeyUpdateError } from './PrimaryKeyUpdateError';

/** A stored field value: a scalar its type accepts, null, or an object for json and blob fields. */
export type SqliteFieldValue = string | number | boolean | null | object;
