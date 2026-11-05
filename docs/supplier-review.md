# SOS supplier review

Use the pricing method appropriate to the supplier source. For SOS first aid supplies or kits, the 25% discount is used only when an administrator explicitly confirms that the item is covered. For PRESTAN and AED spreadsheets, enter the actual listed distributor cost and applicable Canadian MSRP or MAP; do not apply the SOS discount. Manual observations also require the actual supplier cost. Gross profit shown here is retail less supplier cost before shipping, fees, taxes and other expenses. Amounts use integer Canadian cents.

## Import and review

1. Review and apply `supabase/migrations/005_supplier_review.sql`, `006_supplier_admin_only.sql`, and `008_supplier_pricing_methods.sql` in order to a **development** Supabase project after checking its schema, RLS and backups. Do not run them against production without deployment approval. Audit any additional existing policies for this table because PostgreSQL policies can be permissive when combined.
2. Sign in as an administrator and open **Supplier Review**. The API requires a current Supabase session and administrator role, and the table denies anonymous and editor access. Keep the service role key server-side.
3. Enter one observation or paste a JSON array using `docs/supplier-import-template.json`. Supply the product name, retail price, verification date and appropriate pricing method. Manual and SOS observations require an HTTPS SOS product URL. Spreadsheet observations require the source name, item number, actual cost and MAP; advertised price cannot be below MAP. SOS discount observations require explicit confirmation and a first aid supplies or kits category. Include manufacturer, model, specifications, availability and tax basis only when verified. Blank template entries cannot be imported.
4. Gross profit is calculated from the entered retail and supplier cost. Each save returns the observation to `pending`; no product, public price, availability or publication status is changed. Existing observations may contain costs calculated using the former 25% assumption and must be reverified against supplier records. This screen does not yet publish reviewed prices to the product table. Use the existing product editor only after a separate review.

## Research candidates

The following product pages were reachable in supplier research; they are candidates, not imported inventory, published offers, or a confirmation of current price or stock:

- PRESTAN Professional Adult Series 2000 CPR Training Manikin 4-Pack: https://www.sostor.com/products/prestan-professional-adult-series-2000-cpr-training-manikin-4-pack
- PRESTAN Adult Ultralite Manikin 12-Pack: https://www.sostor.com/products/prestan-adult-ultralite-manikin-12-pack
- PRESTAN AED UltraTrainer 4-Pack: https://www.sostor.com/collections/manikins-supplies/products/prestan-aed-ultratrainer-4-pack

Supplier result pages exposed some advertised prices, but retrieved pages were cached and product pages did not reliably expose SKU, current price, stock or tax basis. Obtain a current dated price and confirm tax treatment before entering a review record. Soteria has supplier permission to use photographs and descriptions; obtain and verify the appropriate source assets and variants before importing them.

The quote-only development catalog is based on the SOS collections https://www.sostor.com/collections/manikins-supplies, https://www.sostor.com/collections/aed, and https://www.sostor.com/collections/first-aid-supplies, along with the individual PRESTAN and Defibtech product pages listed above. It does not assert stock or prices. `npm run dev` displays this catalog when no Supabase client is configured. The local preview does not override an existing Supabase catalog. To load the earlier catalog into a development database, review `supabase/migrations/007_sos_quote_catalog.sql`; `009_sos_first_aid_drafts.sql` adds eight first aid draft records, disabled and requiring administrator review. These migrations add only missing IDs and do not update existing records. They have not been applied. Run no migration against production without approval. Database records, including archived records, remain authoritative after import.

## Remaining launch work

The administrator-only Excel preview accepts XLSX files under 1 MB, lets the administrator adjust column mappings and identifies missing prices, duplicate item numbers and fractional-cent amounts. It does not save, approve, import or publish rows. Source files are read for the request only; do not commit workbooks or private prices. Existing price observations need revalidation against the actual supplier files.

The review queue is not a supplier inventory integration or automated fulfillment. A durable spreadsheet import with source dates, repeat-import matching, approval, and history; a manual supplier order workflow; durable order reconciliation; shipping charges; configured Canadian tax handling; real test-mode payment verification; email notifications; course scheduling and registration remain outstanding. The development branch blocks live Stripe Checkout sessions and requires explicit test-mode configuration. No migration has been applied and no supplier records have been written to a live database as part of this work.

The accessible SOS first-aid collection page displayed 24 listings on page 1 and reported 22 pages. The retrieved snapshot did not establish current price dates, SKUs, or image access, and the product-page requests were not available through the research tool. No bulk catalog was imported. The existing administrator-assisted JSON supplier review accepts individual verified observations, but is not yet a persistent product-import or publishing workflow.

Database integration testing needs a separate development Supabase project and its `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or the corresponding `VITE_` URL and anon key), and server-only `SUPABASE_SERVICE_ROLE_KEY`, plus a development administrator login. Confirm the project identity and review migrations and RLS before use. Never supply production credentials for this testing.
