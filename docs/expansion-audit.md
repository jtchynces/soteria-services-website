# Website expansion audit and development plan

Audit baseline: local repository `main` at `efebc83`. This is an inventory of the checked-out source, not a verification of production data or account configuration.

## Existing system

- Vanilla HTML, CSS and JavaScript with a Node HTTP server for local use; `npm run build` validates and copies static files into `dist`.
- Vercel serves the static site and one API dispatcher; the repository points to `jtchynces/soteria-services-website` on GitHub. A Vercel Git connection and production branch cannot be established from the checked-in configuration. Do not push, merge or deploy before checking Vercel project settings and receiving approval.
- Existing routes include training, AED sales, event medical, mask fit testing, Pulse, contact, legal pages, product details, a configurator, cart and admin pages. Existing URLs should be retained.
- Supabase Auth and profile roles protect admin functions. Products, site settings, services, orders and quote requests use Supabase when configured. The actual live schema, policies, credentials and stored data have not been inspected or modified.
- Stripe Checkout sessions are created server-side for individual catalog items, with server-side pricing. The cart does not yet create a multi-item checkout; taxes, shipping and refunds need further implementation and verification. Stripe payment test credentials and a real sandbox transaction have not been verified.
- Configurator prices were present without verified sourcing. Existing entries are disabled on the development branch pending verification. No supplier content or prices have been imported.
- Quotes previously returned success when storage was missing or failed; webhook signature verification was optional if its secret was missing. This branch adds fail-closed handling. Order persistence and webhook reconciliation still require work and end-to-end tests.
- The repo contains `assets/soteria-logo.svg` and `assets/favicon.svg`; the former is a generic text-and-shield graphic, not a verified original logo. The site also loads a logo from Supabase settings. Obtain the original official asset before replacing branding or generating a favicon.
- The production website at both supplied hostnames could not be reached by the audit tool. Live navigation, performance, mobile layout, deployment triggers and production configuration remain unverified. The supplier site was reviewed as a category reference only.
- Tracked `node_modules/stripe` files are present in Git. Existing dependency tracking is preserved for now, but should be cleaned up in a separately reviewed change.

## Implementation sequence

1. Protect lead capture and payment event verification; confirm storage errors are visible and remove unverified catalog offers from publication.
2. Build a server-priced cart and reliable order lifecycle, with idempotent signed webhooks and Stripe test-mode integration tests. Configure shipping and tax only after business/accounting review.
3. Extend the Supabase product model and admin tools with draft publication, approved catalog details and private pricing protected by server authorization and RLS. Do not seed verified-looking products or prices.
4. Add the training catalog, dates, capacity and registration workflow with authorization and payment gates; add corporate training and AED inquiry forms.
5. Expand service and emergency management pages, mark authorization-dependent courses appropriately, and add legal policy drafts for owner/legal review.
6. Add customer accounts and reminders only after data retention, consent and operational workflows are agreed.

## Before deployment

- Confirm official logo, public contact details, service availability, training authorizations and approved supplier products, pricing and imagery.
- Confirm Vercel project/repository/production branch and environment separation; do not push before understanding automatic deployment behavior.
- Review Supabase schema, RLS, admin roles, storage, backups and existing production data before applying migrations.
- Configure Stripe test keys and webhook secret in a nonproduction environment; test success, failure, refunds and webhook retries. Confirm shipping, Canadian taxes and invoicing with the business and accountant.
- Verify quote and order persistence, email delivery, accessibility, navigation and responsive layouts in a staging environment. Review privacy, returns, shipping and course cancellation policies with qualified counsel.
- Obtain explicit approval before merging or deploying changes affecting the live website.
