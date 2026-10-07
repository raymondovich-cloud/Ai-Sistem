-- version 1.0
-- pg_net is recreated in the extensions schema after confirming no pending requests.
drop extension if exists pg_net;
create extension pg_net with schema extensions;