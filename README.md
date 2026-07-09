# Soteria Services Marketing Website v1.1.0 - Stripe Commerce Launch

Launch-focused marketing website with Stripe Checkout support for Buy Now and Deposit Only products, quote request workflows, and protected admin/editor pages.

## Required environment variables

Copy `.env.example` and configure these values locally and in Vercel:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SITE_URL=http://localhost:3000
```

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must stay server-side. They are never exposed in client code.

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

The build validates required launch files and JavaScript syntax.

## Test Stripe Checkout

1. Use Stripe test mode keys.
2. Set `STRIPE_SECRET_KEY` and `SITE_URL`.
3. Run `npm run dev`.
4. Click a Buy Now or Pay Deposit button.
5. Use Stripe test card `4242 4242 4242 4242` with any future expiry, CVC, and postal code.
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

## Product admin

Joshua Chynces is configured as administrator. Shaylee Taillefer is configured as editor. The static admin uses hashed password checks and local browser storage for launch editing. Replace with backend authentication before storing sensitive settings.

Editors can manage public products/content. Editors cannot access payment keys, security settings, billing settings, or admin user management.

## Tax note

Product records include `tax_behavior`: `taxable`, `non_taxable`, or `confirm_manually`. Stripe Tax is not enabled automatically. Tax handling should be reviewed before full e-commerce launch.

## Deploy to Vercel

1. Push the project to Git.
2. Import into Vercel.
3. Add the required environment variables.
4. Configure the Stripe webhook URL after deployment.
5. Run a Stripe test-mode checkout before switching to live keys.
