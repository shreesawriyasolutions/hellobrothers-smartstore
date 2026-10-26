# Hello Brothers Smart Store

Website for Hello Brothers Smart Store, M.G. Road, Opp. Shri Ram Studio, Safidon, Jind (Haryana).
Phone / WhatsApp: +91 94684 51450, +91 86850 76900

- `index.html` – home page; `track.html` – customer enters mobile number and sees repair status
- `repairs-admin.html` – staff/admin login: add customer + phone repair, update status
- `sale.html`, `bills.html`, `visitors.html` – admin tools
- `config.js` – **only place** for the Supabase URL + publishable key (this site's own Supabase project)
- `supabase/setup.sql` – run once in a new Supabase project to create all tables, security rules and functions

This site is fully separate from shreesawriyasolutions.in: different repository, different Supabase account, no shared data.
