# Soteria Services Marketing Website v1.1.0 - Stripe Commerce Launch

Launch-focused marketing website with Stripe Checkout support, quote request workflows, and Supabase-protected admin/editor pages.

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

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

The build validates required launch files, JavaScript syntax, Stripe dependencies, Supabase dependencies, and generates the `dist` folder for Vercel.

## Verify Stripe Checkout

1. Use Stripe sandbox mode keys.
2. Set `STRIPE_SECRET_KEY` and `SITE_URL`.
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

Supabase is the production source of truth. Starter products and starter settings are not used when Supabase content storage is configured, even if a table is empty. Seed rows are guarded so they only populate a brand-new empty table and never overwrite existing records. Set `ENABLE_DEMO_CONTENT=true` only for an intentional local demo without Supabase content.

## AED configurator

The AED Configurator loads from `config/aed-configurator.json` while inventory management is being prepared. Update that file to add AED models, accessories, prices, descriptions, images, availability, or enabled/disabled status. The frontend uses a `ProductProvider` abstraction, so `inventoryEnabled` can later switch the same interface to product records without redesigning the configurator.

## Tax note

Product records include `tax_behavior`: `taxable`, `non_taxable`, or `confirm_manually`. Stripe Tax is not enabled automatically. Tax handling should be reviewed before full e-commerce launch.

## Deploy to Vercel

1. Push the project to Git.
2. Import into Vercel.
3. Add the required environment variables.
4. Configure the Stripe webhook URL after deployment.
5. Run a Stripe sandbox checkout before switching to live keys.
