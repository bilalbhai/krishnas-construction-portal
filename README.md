# Krishna's Construction Portal

A private business management app for Eric Krishna's carpentry business. It keeps customer details, jobs, quotes, bookings, invoices and payments together so information does not need to be entered repeatedly.

The website uses plain HTML, CSS and JavaScript. Supabase provides secure login and the private database. GitHub Pages hosts the website files.

## What it includes

- Customer records, search and multiple jobs per customer.
- Fixed-price, hourly and cost-plus quotations.
- Booking confirmations and job progress tracking.
- Invoices, deposits, final payments and unpaid-invoice reminders.
- Branded A4 PDFs to download and send manually.
- Business details, payment instructions and approved document artwork.
- Database security rules that restrict records to authorised team members.

## Preview on your computer

**To explore the interface:** double-click `index.html`, then choose **Explore interface preview**. You do not need npm, a framework or a build command.

**To use a connected database locally:** double-click `Preview Portal.cmd`, keep the terminal window open, and use `http://127.0.0.1:4173` in your browser. The optional local server needs Node.js. You can also start it with:

```powershell
node scripts/serve.mjs
```

Opening the HTML file directly gives a preview only. It cannot log in or access private database records.

## Connect the database before going live

1. Create a free Supabase project.
2. Apply the five SQL files in `supabase/migrations/`, in number order.
3. Disable public signup and create the two authorised accounts.
4. Add their workspace memberships using the setup guide.
5. Copy `js/config.example.js` to `js/config.js` and enter the project URL and **public publishable key**.
6. Test login and the complete customer-to-payment workflow locally.

See the [step-by-step setup guide](docs/SETUP_GUIDE.md) for the exact instructions. Never put a Supabase secret/service-role key or a database password in the website.

## Put the code on GitHub

Create a new empty repository called `krishnas-construction-portal`. Choose **Public** for GitHub Pages on GitHub Free, or **Private** if your plan supports Pages for private repositories. Do not add a README, .gitignore or licence on GitHub when creating it: the local project already has its files.

After the local first commit, connect your own repository URL and push using plain Git:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/krishnas-construction-portal.git
git push -u origin main
```

Do not run these example commands until your repository exists. GitHub may ask you to sign in. Do not put passwords or tokens in the URL.

## Deploy with GitHub Pages

1. In the repository, open **Settings → Pages** and select **GitHub Actions** as the source.
2. Add the repository Actions variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` using your public connection values.
3. In **Actions**, run **Publish approved portal**.
4. Add the final website URL to Supabase's allowed login/recovery addresses.
5. Complete the [live acceptance checklist](docs/CLIENT_APPROVAL_CHECKLIST.md).

The deployment runs only when you start it manually. Pushing code does not automatically publish the site. Supabase and GitHub free-tier limits can change; the setup guide links to the providers' current information.

## Keep private files off GitHub

`.gitignore` excludes local connection settings, private notes, original reference documents, backups, generated PDFs and temporary files. The official business logo and application source belong in Git. Customer records, bank details, signatures, passwords and secret keys do not.

## Project folders

| Folder | Purpose |
|---|---|
| `css/` | Colours, spacing and responsive layouts |
| `js/` | Forms, login, database calls, calculations and PDFs |
| `assets/` | Official logo and public website assets |
| `supabase/migrations/` | Database tables, security rules and document numbering |
| `scripts/` | Optional local preview and deployment packaging |
| `tests/` | Calculation, database, interface and PDF checks |
| `docs/` | Detailed setup, security and user guides |

## Testing status

The local implementation has passed 44 automated checks, responsive entry-page checks at phone/tablet/desktop widths, and a real sample PDF download. Live Supabase login, email recovery, cross-device persistence and production deployment still need to be verified after account setup. See [test details and limitations](docs/TEST_RESULTS.md).

No real customer documents have been issued by this project, and preview mode never pretends to save records.
