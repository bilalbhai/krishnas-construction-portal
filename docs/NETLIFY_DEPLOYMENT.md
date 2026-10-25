# Deploy the portal with Netlify Free

Netlify is the recommended production host for this authenticated business portal. The code stays in GitHub, while Supabase continues to handle private records and login. No database migration or account transfer is involved in changing the static host.

## Why this recommendation changed

GitHub Pages is a useful static host, but its published limits restrict business/commercial transaction hosting and discourage password transactions. Vercel Hobby is restricted to personal, non-commercial use. Netlify explicitly permits commercial projects on its Free plan, subject to its usage limits.

Sources checked 25 October 2026:

- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://vercel.com/docs/plans/hobby
- https://www.netlify.com/blog/introducing-netlify-free-plan/
- https://www.netlify.com/pricing/

## Addresses and costs

Your repository remains https://github.com/bilalbhai/krishnas-construction-portal. A free Netlify address looks like https://YOUR-PROJECT.netlify.app. Connecting an existing custom domain and automatic HTTPS are included, but registering a new .com or .com.au domain is a separate purchase. A GitHub-issued github.io hostname belongs to GitHub Pages; it cannot be assigned as a Netlify hostname.

Netlify Free currently has 300 credits per month. Production deploys and traffic consume credits; Free sites can pause when the limit is reached. Check Usage & billing, remain on Free, and do not enable a paid plan just to finish setup. Free hosting is subject to provider limits, not an unlimited-service promise.

## Click-by-click setup

1. Open https://app.netlify.com/signup and choose GitHub to sign up/sign in. Complete account creation yourself. Choose the Free plan if prompted.
2. On the team's Projects page, choose Add new project > Import an existing project.
3. Select GitHub. In the GitHub permission screen, choose Only select repositories and select bilalbhai/krishnas-construction-portal, then complete the requested authorisation.
4. Back in Netlify, select krishnas-construction-portal.
5. Set the project name to krishnas-construction-portal, or another available name. The resulting free hostname depends on name availability.
6. Confirm these settings. netlify.toml in GitHub should fill the command/output automatically:
   - Production branch: main
   - Framework: None / Other (plain static HTML)
   - Base directory: blank (repository root)
   - Build command: node scripts/prepare-pages.mjs
   - Publish directory: dist
   - Functions directory: blank
7. Expand Environment variables / Add environment variables. Add these two ordinary public configuration variables:
   - SUPABASE_URL: your base https://PROJECT.supabase.co URL, with no /rest/v1 suffix.
   - SUPABASE*PUBLISHABLE_KEY: the sb_publishable*... key from Supabase.
     Keep the default build/production scope if options are offered. Do not add a database password, secret key or service-role key. The values are intentionally included in the browser configuration; private access is enforced by authentication and database policies.
8. Confirm with Publish. This is the action that publishes the frontend. Some accounts first create a private team preview; if public access is a separate choice, publish the frontend login page publicly so Eric can reach it. Customer records remain protected by Supabase sign-in and membership rules.
9. Wait for the production deploy to show Published/Ready, then open the generated HTTPS address. SSL is automatic for the netlify.app hostname.

If the environment-variable fields are not offered before the first deployment, add them at Project configuration > Environment variables. Then open Deploys and trigger a new deployment of main. A build without the required values fails with a clear message instead of publishing a disconnected login page.

This command only copies existing static files and writes the two public connection values into dist/js/config.js. It does not compile a framework, run npm or start a server. The publication folder excludes private notes, references, database setup files, test output and original customer documents. Do not set the publish directory to the repository root.

## Supabase URLs after deployment

In your Supabase project, open Authentication > URL Configuration:

1. Set Site URL to the actual Netlify origin, for example https://YOUR-PROJECT.netlify.app.
2. Under Redirect URLs, add https://YOUR-PROJECT.netlify.app/index.html exactly.
3. Preserve http://127.0.0.1:4173/index.html if you still need local password recovery testing.
4. Save changes. When you later add a custom domain, update/add its URLs as well.

Public signup and anonymous sign-in must remain off. If you have not yet run private/ENABLE_ADMIN.sql in the Supabase SQL Editor, do that before testing your administrator login. Creating an Auth user alone does not grant workspace membership. No password should be sent to an assistant or committed to Git.

## Verify the live site

- Sign in using your own account; do not select interface preview.
- Add a clearly labelled TEST customer and verify it remains after signing in again.
- Open a draft quotation and download a SAMPLE / NOT FOR ISSUE PDF.
- Sign out and confirm that private records are no longer visible.
- Test password reset after its provider email delivery and redirect URLs are configured.
- Follow CLIENT_APPROVAL_CHECKLIST.md before issuing real customer documents.

The project has not been published by preparing these files. After importing, Netlify will normally redeploy whenever main is pushed. Future code pushes can therefore change the live site. GitHub Pages' separate manual workflow remains in the repository for reference, but is not the recommended production path.

## Australia and performance

Netlify uses a global CDN. GitHub Pages and Vercel also distribute static files globally, so all are expected to be suitable for a small HTML frontend in Australia; no comparative Australian benchmark was run. Your Supabase project is currently in Singapore, so authenticated database response time still depends on that region whichever static host is selected.

Documentation:

- https://docs.netlify.com/start/quickstarts/deploy-from-repository/
- https://docs.netlify.com/build/environment-variables/get-started/
- https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/
- https://supabase.com/docs/guides/auth/redirect-urls
