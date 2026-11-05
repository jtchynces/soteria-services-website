# SOS supplier review

Soteria reports an SOS agreement for eligible items: retail matches the supplier's advertised retail, supplier cost is 75% of that amount, and the initial gross profit is the difference before expenses. Shipping, taxes and other fees are not discounted by this calculation. Amounts use integer Canadian cents, with cost rounded to the nearest cent; confirm rounding with the supplier when invoices differ.

## Import and review

1. Apply `supabase/migrations/005_supplier_review.sql` followed by `supabase/migrations/006_supplier_admin_only.sql` to a **development** Supabase project after checking its schema, RLS and backups. Do not run them against production without deployment approval. Audit any additional existing policies for this table because PostgreSQL policies can be permissive when combined.
2. Sign in as an administrator and open **Supplier Review**. The API requires a current Supabase session and administrator role, and the table denies anonymous and editor access. Keep the service role key server-side.
3. Enter one observation or paste a JSON array using `docs/supplier-import-template.json`. Required fields are product name, HTTPS SOS product URL, retail price in cents and the date the price was verified. Include SKU, manufacturer, model, category, original specifications, availability and tax basis when verified. Blank template entries cannot be imported.
4. Cost and gross profit are calculated from retail. Each save returns the observation to `pending`; no product, public price, availability or publication status is changed. This screen does not yet publish reviewed prices to the product table. Use the existing product editor only after a separate review.

## Research candidates

The following product pages were reachable in supplier research; they are candidates, not imported inventory, published offers, or a confirmation of current price or stock:

- PRESTAN Professional Adult Series 2000 CPR Training Manikin 4-Pack: https://www.sostor.com/products/prestan-professional-adult-series-2000-cpr-training-manikin-4-pack
- PRESTAN Adult Ultralite Manikin 12-Pack: https://www.sostor.com/products/prestan-adult-ultralite-manikin-12-pack
- PRESTAN AED UltraTrainer 4-Pack: https://www.sostor.com/collections/manikins-supplies/products/prestan-aed-ultratrainer-4-pack

Supplier result pages exposed some advertised prices, but retrieved pages were cached and product pages did not reliably expose SKU, current price, stock or tax basis. Obtain a current dated price and confirm tax treatment before entering a review record. Do not copy supplier photographs or descriptions without permission. Verify variant details and authorized assets separately.

## Remaining launch work

The review queue is not a supplier inventory integration or automated fulfillment. A manual supplier order workflow, durable order reconciliation, shipping charges, configured Canadian tax handling, real test-mode payment verification, email notifications, course scheduling and registration remain outstanding. The development branch blocks live Stripe Checkout sessions. No migration has been applied and no supplier records have been written to a live database as part of this work.
