# Smart Test Maker — AI paper backend

This backend lets the GitHub Pages app upload an original PTS PDF to Gemini for visual analysis and new-paper generation. The Gemini API key stays on the server as a Cloudflare Worker secret; it is never placed in the public website.

## Files
- `api/worker.js` — secure PDF-to-Gemini endpoint.
- `wrangler.toml` — Cloudflare Worker configuration.

## One-time setup (Cloudflare + Google AI Studio)

### Automatic deployment from GitHub

A GitHub Actions workflow is included. To let it deploy the Worker for you:

1. Create a Cloudflare API token using the **Edit Cloudflare Workers** template.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named `CLOUDFLARE_API_TOKEN` containing that token.
4. Add a repository variable named `CLOUDFLARE_ACCOUNT_ID` containing your Cloudflare Account ID.
5. Open the repository **Actions** tab, select **Deploy Smart Test Maker AI Worker**, and choose **Run workflow**. Later changes to `api/worker.js` or `wrangler.toml` on `main` deploy automatically.

The workflow deploys the Worker code only. You must still add `GEMINI_API_KEY` and `APP_ACCESS_PASSWORD` as Cloudflare Worker **Secrets** in the Cloudflare dashboard after the first deployment.

1. Create/sign in to a Cloudflare account and open **Workers & Pages**.
2. Create a Worker named `smart-test-maker-ai`.
3. Deploy this repository's `api/worker.js` as the Worker entry point (or connect the repository using Workers Builds and set the root directory to the repository).
4. In Worker **Settings → Variables and Secrets**, add these as **Secret** values:
   - `GEMINI_API_KEY` — create an API key in Google AI Studio.
   - `APP_ACCESS_PASSWORD` — create a long, private password (at least 12 characters). Do not use your GitHub or Google password.
5. Keep `GEMINI_MODEL` as `gemini-2.5-flash` initially. It can be changed later in Worker variables if Google changes model availability.
6. Deploy the Worker and copy its `workers.dev` URL.
7. Open Smart Test Maker → **Generate New Paper with AI**, paste the Worker URL, and enter the same private app access password. The password is not saved by the app.

## Usage
1. Generate and download the PTS paper using your authorized PTS access.
2. In Smart Test Maker, choose the original PDF, enter your school's name and watermark, then select **Generate New Paper**.
3. Review the generated questions, Urdu, formulas, section totals and overall marks. Use **Print / Save as PDF** only after checking the paper.

## Limits and privacy
- This version accepts PDF files up to 18 MB.
- GitHub Pages is static hosting; the Cloudflare Worker is the secure server-side bridge.
- Gemini API free-tier availability, model access and rate limits depend on the Google AI Studio project. Google's current pricing page says free-tier submitted content may be used to improve Google products. Do not upload student personal data, confidential school records, or material you are not authorized to submit to Google. Check the current provider terms and school permissions before use.
- Cloudflare Worker secrets keep API credentials out of public GitHub code. Do not commit API keys or app passwords.
- The endpoint restricts browser requests to the Smart Test Maker GitHub Pages origin and checks the app password. This is basic access control, not a substitute for a dedicated school login or stronger abuse controls if the app becomes public.
- AI-generated questions can contain mistakes. A teacher must verify syllabus fit, correctness, Urdu wording and marks before printing.
- PTS access does not automatically grant rights to reproduce or redistribute its protected question bank. Use only content within the permissions and licence that apply to your school.

## Troubleshooting
- **Backend setup incomplete:** add both Worker secrets and deploy again.
- **Access password incorrect:** the password entered in the website must exactly match `APP_ACCESS_PASSWORD`.
- **Origin not allowed:** use the official GitHub Pages site URL, not a local file or preview domain.
- **PDF too large:** use a smaller PTS PDF (18 MB maximum in this version).
- **AI quota/model error:** check Google AI Studio model availability, rate limits and API key status.
