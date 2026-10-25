# Security setup and review

Use migrations 001–005 and the account-owner steps in README. Anonymous roles have no table/read/RPC grants. Authenticated table reads require organisation membership. Browser writes use narrowly scoped functions that derive the organisation from `auth.uid()`. RLS is enabled on every business table, including membership, counters and audits. There are no browser grants to mutate roles or organisations.

Owner/administrator can manage settings, archive/delete customers, void eligible documents and issue credits. Employees can work with customers/jobs/documents/receipts but cannot change bank details, approve artwork or grant access. Membership is inserted through the Supabase dashboard/SQL Editor by a trusted project administrator. Disable public and anonymous signup at the provider.

Signatures/stamps/uploads live in a non-public Storage bucket limited to PNG/JPEG and 2 MB. Names begin with organisation UUID. Read policies require matching membership; insert policies require matching owner/admin role. There are no update/delete object policies. Uploads use new UUID filenames, preserving artwork referenced by old snapshots. Client-side magic-byte/dimension checks reject obvious invalid images; storage policies enforce type/size/access independently. An authorised owner can upload artwork, not executable HTML/SVG. Browser downloads use authenticated requests, never public object URLs.

The original supplied business logo is the only public image. Do not put signatures or invoice screenshot assets in `assets/`. Approved payment instructions are database settings, not committed frontend constants. The privately supplied street address is in ignored private notes only.

User-authored text is escaped before HTML rendering. PDFs draw text and raster images rather than executing HTML. The application never stores customer fields or drafts in localStorage/sessionStorage/IndexedDB. Auth tokens are in memory. No customer data in navigation URLs. No automated outgoing customer emails, no Gmail/Outlook connection.

Before production, verify the actual hosted project using separate approved member/nonmember accounts and an unauthenticated client. Check table and Storage policies in Supabase Security Advisor; test anonymous REST requests, tenant isolation, password recovery delivery/redirects and real simultaneous numbering. Keep project-owner credentials outside the public repository. Public publishable keys are expected; service-role/secret keys are forbidden in any browser asset.

Configure a manual backup/export procedure. Audit events contain action/entity/actor/time, without copying names, phone numbers or scope into logs. Customer deletion requires an impact review and typed customer ID. Customers with any jobs can only be archived in the UI; financial records are never cascade-deleted. A verified statutory/privacy purge is a separate administrator process with retention review, not an unrestricted public RPC.

Direct-file previews cannot connect to Auth or the private database, even when a public key is configured. All named HTML entries enforce the same login gate. Only an HTTP/HTTPS connection with authenticated membership enables private operations.
