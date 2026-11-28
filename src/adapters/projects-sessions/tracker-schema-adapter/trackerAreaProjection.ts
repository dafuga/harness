// @harness-uid u_tzqekyfiyf
/** Live claim read model, reconstructed on each replica from signed journal events. */
export const trackerAreaProjection = `
CREATE INDEX IF NOT EXISTS ops_tracker_area ON ops(item_id,hlc)
 WHERE json_type(fields,'$.area_claim') IS NOT NULL OR json_type(fields,'$.area_release') IS NOT NULL OR json_type(fields,'$.area_stop_idle') IS NOT NULL
 OR json_extract(fields,'$.status') IN ('blocked','done','ignored') OR json_extract(fields,'$.deleted')=1;
CREATE INDEX IF NOT EXISTS ops_tracker_grants ON ops(item_id,hlc) WHERE json_type(fields,'$.area_claim')='object';
CREATE VIEW IF NOT EXISTS tracker_item_areas AS
 SELECT g.item_id AS area_item_id,json_extract(g.fields,'$.area_claim.label') AS area_claim FROM ops g
 WHERE json_type(g.fields,'$.area_claim')='object' AND NOT EXISTS (
 SELECT 1 FROM ops e WHERE e.item_id=g.item_id AND e.hlc>g.hlc AND (
 json_type(e.fields,'$.area_claim') IS NOT NULL OR json_extract(e.fields,'$.status') IN ('blocked','done','ignored')
 OR json_extract(e.fields,'$.deleted')=1 OR (json_type(e.fields,'$.area_stop_idle')='text'
 AND e.node=json_extract(g.fields,'$.area_claim.node') AND (json_extract(g.fields,'$.area_claim.token') GLOB 'manual:*'
 OR json_extract(g.fields,'$.area_claim.token')=json_extract(e.fields,'$.area_stop_idle')))
 OR (e.node=json_extract(g.fields,'$.area_claim.node')
 AND json_extract(e.fields,'$.area_release')=json_extract(g.fields,'$.area_claim.token')
 AND json_extract(e.fields,'$.area_attempt')=json_extract(g.fields,'$.area_claim.attempt'))));
`;
