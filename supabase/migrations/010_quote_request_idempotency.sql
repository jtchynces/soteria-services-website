-- Apply only to a reviewed development project before testing quote-cart submission.
alter table public.quote_requests add column if not exists client_request_id uuid;
create unique index if not exists quote_requests_client_request_id_unique
  on public.quote_requests (client_request_id) where client_request_id is not null;
