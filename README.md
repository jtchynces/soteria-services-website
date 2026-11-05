# Soteria Services Marketing Website v1.1.0 - Stripe Commerce Launch

Launch-focused marketing website with Stripe Checkout support, quote request workflows, and Supabase-protected admin/editor pages.

For the current expansion audit, prioritized implementation plan, outstanding launch work and deployment checklist, see [docs/expansion-audit.md](docs/expansion-audit.md). Changes on the development branch require review before deployment.

For SOS supplier price reviews and the private import template, see [docs/supplier-review.md](docs/supplier-review.md).

## Required environment variables

Copy `.env.example` and configure these values locally and in Vercel:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SITE_URL=http://localhost:3000
SUPABASE_URL=
VITE_SUPABASE_URL=
SUPABASE_ANON_KEY=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENABLE_DEMO_CONTENT=false
```

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` must stay server-side. They are never exposed in client code. The browser receives only the Supabase URL and anon key through `/api/auth-config`. Product and settings saves use `SUPABASE_SERVICE_ROLE_KEY` when it is available, and otherwise use the configured Supabase URL/anon key with the logged-in user's Supabase access token and RLS policies.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Restart the server after updating the code.

`npm run dev` starts a localhost-only preview that displays the full website even when the saved `public_site_mode` is `coming_soon`. The override exists only in the response from this local server; it never updates Supabase or changes Vercel's production API. Admin routes still require authentication and the existing checkout restrictions remain in force. If Supabase is not configured, the preview displays the quote-only SOS catalog; when Supabase is configured, its product records remain authoritative. The separate `npm start` command does not enable the bypass.

## Build

```bash
npm run build
```

The build validates required launch files, JavaScript syntax, Stripe dependencies, Supabase dependencies, and generates the `dist` folder for Vercel.

## Verify Stripe Checkout

1. Use Stripe sandbox mode keys.
2. Set `STRIPE_SECRET_KEY`, `SITE_URL`, and `ENABLE_STRIPE_SANDBOX_CHECKOUT=true` in an isolated test environment. Checkout remains blocked by default and live keys cannot create sessions on this branch.
3. Run `npm run dev`.
4. Click a Buy Now or Pay Deposit button.
5. Use Stripe sandbox card `4242 4242 4242 4242` with any future expiry, CVC, and postal code.
6. Confirm the success return at `/checkout/success?session_id=...`.

## Webhook setup

Create a Stripe webhook endpoint pointing to:

```text
https://your-domain.com/api/stripe-webhook
```

Subscribe to:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

Set the webhook signing secret as `STRIPE_WEBHOOK_SECRET`.

Webhook events are normalized for Soteria Pulse sync and written to Supabase order storage when Supabase environment variables are configured.

## Pre-launch mode

Store `public_site_mode=coming_soon` in the Supabase `site_settings` table to show the public launch screen while admin routes remain available. Set it to `live` to show the full public website. `PUBLIC_SITE_MODE` is only a local fallback when Supabase content storage is not configured.

Public pre-launch mode keeps product and service pages hidden from visitors while allowing quote requests and protected admin access.

## Supabase authentication

Admin and editor login uses Supabase Auth email/password. There are no hardcoded users or shared credentials in the website. Roles live in the Supabase `profiles` table linked to `auth.users`.

1. Create a Supabase project.
2. Paste and run `supabase/migrations/001_auth_profiles_roles.sql` in the Supabase SQL editor.
3. Paste and run `supabase/migrations/002_prelaunch_content_storage.sql` in the Supabase SQL editor.
4. In Supabase Authentication, create Joshua's first user account with his real email and a temporary secure password.
5. Run this SQL, replacing the email value:

```sql
update public.profiles
set full_name = 'Joshua Chynces', role = 'administrator'
where lower(email) = lower('JOSHUA_EMAIL_HERE');
```

6. Add Supabase environment variables locally and in Vercel.
7. Joshua can log in at `/admin`, use Invite User, and invite Shay as `editor`.

Shay Taillefer should be assigned the editor role. Editors can manage public products, services, pricing, inventory, and content. Editors cannot access payment/security settings, billing settings, admin user management, or user deletion.

The Forgot Password action uses Supabase Auth password reset email. Configure the production site URL and email templates in Supabase before launch.

## Product admin

Product edits, quote requests, orders, media records, services, and site settings are stored in Supabase tables when Supabase environment variables are configured. This preserves Shay's updates across deployments, browsers, devices, and future code updates.

Published products set to `Request Quote` display “Price on request” rather than their internal numeric amount and cannot be added to the cart. Confirm product identity, supplier availability and resale authorization before enabling a product. The existing editor stores an unused zero amount for an unpriced quote item; zero is not a verified selling price. Supplier cost observations are administrator-only and use a separate private table; apply and review both supplier migrations in a development database before testing that access.

Supabase is the production source of truth. Starter products and starter settings are not used when Supabase content storage is configured, even if a table is empty. Seed rows are guarded so they only populate a brand-new empty table and never overwrite existing records. Set `ENABLE_DEMO_CONTENT=true` only for an intentional local demo without Supabase content.

## AED configurator

The AED Configurator derives its choices from the same product catalog as the storefront. It builds a quote with individual equipment, quantities, and optional installation, training, and Soteria Pulse inquiries. Accessory selection is fail-closed and validated again by the server; no catalog accessories are currently bound to verified manufacturer part numbers. See [docs/aed-compatibility.md](docs/aed-compatibility.md). Availability, tax, and delivery must also be confirmed in the quote. The configurator does not initiate checkout. When no Supabase client is configured, local development can preview the quote-only supplier catalog; this does not publish or write products to a database.

The cart submits product IDs and quantities to the server, which resolves prices from the product catalog. Checkout requires an explicit server-side `checkout_verified` flag as well as `non_taxable` status. The present product schema and admin workflow do not yet provide this verification flag, so existing products remain quote-only; configuring a Stripe key does not enable their checkout. Shipping options, tax configuration, a durable verification workflow, reliable order reconciliation and a real Stripe test transaction remain outstanding. Do not treat this branch as ready for production checkout.

## Development checks

Run `npm run build`, `node scripts/test-local-preview.js`, `node scripts/test-commerce-safety.js` and `node scripts/test-expansion.js`. Local preview mode does not isolate a configured Supabase project: use development credentials when testing operations that write data, such as admin edits or quote submissions.

## Tax note

Product records include `tax_behavior`: `taxable`, `non_taxable`, or `confirm_manually`. Stripe Tax is not enabled automatically. Tax handling should be reviewed before full e-commerce launch.

## Deploy to Vercel

1. Push the project to Git.
2. Import into Vercel.
3. Add the required environment variables.
4. Configure the Stripe webhook URL after deployment.
5. Run a Stripe sandbox checkout before switching to live keys.
