# Static delivery-area list replaces the DB-backed Delivery Regions feature

The customer form's "Region (optional)" field was a `<select>` fed by a DB-backed Delivery Regions admin feature (`/api/delivery-areas`, the `Delivery_Areas` table, the Settings panel). We replaced it with a free-text input whose suggestions come from a static list of real Melaka and Johor districts/towns in `frontend/src/data/deliveryAreas.ts`. The DB feature — route, module, table, and Settings panel — was removed entirely.

We picked a static list because the supplier needs helpful place-name suggestions, not live geocoding (no API, no cost), and the list can't be exhaustive — Malaysia has hundreds of smaller localities — so free text is always allowed. Consequently `Customer.area` is now an open, nullable free-text string (`VarChar(150)`) with no referential authority; the backend still validates it as an optional string only.

Consequences: existing `area` values on customers remain valid; a future maintainer should not reintroduce a DB table unless real delivery areas need to be centrally managed.