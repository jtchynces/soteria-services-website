# SOS supplier review

Record the actual distributor cost from the supplier's source and the applicable Canadian MSRP or MAP. Supplier discounts vary by item. Gross profit shown here is retail less supplier cost before shipping, fees, taxes and other expenses. Amounts use integer Canadian cents.

## Import and review

1. Apply `supabase/migrations/005_supplier_review.sql` followed by `supabase/migrations/006_supplier_admin_only.sql` to a **development** Supabase project after checking its schema, RLS and backups. Do not run them against production without deployment approval. Audit any additional existing policies for this table because PostgreSQL policies can be permissive when combined.
2. Sign in as an administrator and open **Supplier Review**. The API requires a current Supabase session and administrator role, and the table denies anonymous and editor access. Keep the service role key server-side.
3. Enter one observation or paste a JSON array using `docs/supplier-import-template.json`. Required fields are product name, HTTPS SOS product URL, retail price and actual supplier cost in cents, and the date the price was verified. Include SKU, manufacturer, model, category, original specifications, availability and tax basis when verified. Blank template entries cannot be imported.
4. Gross profit is calculated from the entered retail and supplier cost. Each save returns the observation to `pending`; no product, public price, availability or publication status is changed. Existing observations may contain costs calculated using the former 25% assumption and must be reverified against supplier records. This screen does not yet publish reviewed prices to the product table. Use the existing product editor only after a separate review.

## Research candidates

The following product pages were reachable in supplier research; they are candidates, not imported inventory, published offers, or a confirmation of current price or stock:

- PRESTAN Professional Adult Series 2000 CPR Training Manikin 4-Pack: https://www.sostor.com/products/prestan-professional-adult-series-2000-cpr-training-manikin-4-pack
- PRESTAN Adult Ultralite Manikin 12-Pack: https://www.sostor.com/products/prestan-adult-ultralite-manikin-12-pack
- PRESTAN AED UltraTrainer 4-Pack: https://www.sostor.com/collections/manikins-supplies/products/prestan-aed-ultratrainer-4-pack

Supplier result pages exposed some advertised prices, but retrieved pages were cached and product pages did not reliably expose SKU, current price, stock or tax basis. Obtain a current dated price and confirm tax treatment before entering a review record. Do not copy supplier photographs or descriptions without permission. Verify variant details and authorized assets separately.

The quote-only development catalog is based on the following SOS collections: https://www.sostor.com/collections/manikins-supplies and https://www.sostor.com/collections/aed, along with the individual PRESTAN and Defibtech product pages listed above. It does not assert stock or prices. `npm run dev` displays this catalog when no Supabase client is configured. The local preview does not override an existing Supabase catalog. To load these products into a development database, review and run `supabase/migrations/007_sos_quote_catalog.sql`; it adds only missing IDs and never updates existing records. Run no migration against production without approval. Database records, including archived records, remain authoritative after import.

## Remaining launch work

The administrator-only Excel preview accepts XLSX files under 1 MB, lets the administrator adjust column mappings and identifies missing prices, duplicate item numbers and fractional-cent amounts. It does not save, approve, import or publish rows. Source files are read for the request only; do not commit workbooks or private prices. Existing price observations need revalidation against the actual supplier files.

The review queue is not a supplier inventory integration or automated fulfillment. A durable spreadsheet import with source dates, repeat-import matching, approval, and history; a manual supplier order workflow; durable order reconciliation; shipping charges; configured Canadian tax handling; real test-mode payment verification; email notifications; course scheduling and registration remain outstanding. The development branch blocks live Stripe Checkout sessions and requires explicit test-mode configuration. No migration has been applied and no supplier records have been written to a live database as part of this work.
