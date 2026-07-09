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
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` must stay server-side. They are never exposed in client code. The browser only receives the Supabase URL and anon key through `/api/auth-config`.

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

Current storage note: webhook events are normalized for future Soteria Pulse sync, but persistent database storage is not connected yet. Connect Supabase or another database before relying on webhook state as the system of record.

## Supabase authentication

Admin and editor login uses Supabase Auth email/password. There are no hardcoded users or shared credentials in the website. Roles live in the Supabase `profiles` table linked to `auth.users`.

1. Create a Supabase project.
2. Paste and run `supabase/migrations/001_auth_profiles_roles.sql` in the Supabase SQL editor.
3. In Supabase Authentication, create Joshua's first user account with his real email and a temporary secure password.
4. Run this SQL, replacing the email value:

```sql
update public.profiles
set full_name = 'Joshua Chynces', role = 'administrator'
where lower(email) = lower('JOSHUA_EMAIL_HERE');
```

5. Add Supabase environment variables locally and in Vercel.
6. Joshua can log in at `/admin`, use Invite User, and invite Shay as `editor`.

Shay Taillefer should be assigned the editor role. Editors can manage public products, services, pricing, inventory, and content. Editors cannot access payment/security settings, billing settings, admin user management, or user deletion.

The Forgot Password action uses Supabase Auth password reset email. Configure the production site URL and email templates in Supabase before launch.

## Product admin

Product and order edits are still stored locally until persistent product/order storage is connected. Supabase Auth protects access to the admin screens now; the next backend step is moving products, orders, and content into Supabase tables.

## Tax note

Product records include `tax_behavior`: `taxable`, `non_taxable`, or `confirm_manually`. Stripe Tax is not enabled automatically. Tax handling should be reviewed before full e-commerce launch.

## Deploy to Vercel

1. Push the project to Git.
2. Import into Vercel.
3. Add the required environment variables.
4. Configure the Stripe webhook URL after deployment.
5. Run a Stripe sandbox checkout before switching to live keys.
