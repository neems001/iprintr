# iprintr

iprintr is a web app for creating images from text. A user writes a description, chooses an image engine, and receives a generated image. The app saves generated images in Vercel Blob and can save image history in PostgreSQL.

## What the app can do

- Generate realistic images with FLUX.
- Generate artwork with SDXL.
- Generate images with Gemini.
- Improve a short prompt before generation.
- Let guests generate images and keep history without creating an account.
- Let users sign in with OAuth and sync their guest images to their account.
- Store generated image files in a public Vercel Blob store.

## Current project status

Image generation, Blob storage, database storage, guest sessions, and image display work locally with development services. OAuth sign-in uses Clerk and becomes available when Clerk development keys are present.

## Requirements

Install or create the following before starting:

- Node.js 20.9 or newer
- npm
- A PostgreSQL database
- A public Vercel Blob store
- A Hugging Face access token for FLUX and SDXL
- A Gemini API key for Gemini images and prompt improvement
- A Clerk development instance if you want OAuth sign-in locally

Use separate development services when working locally. Do not use production keys or production data for local testing.

## Quick start

### 1. Install the project

```bash
npm ci
```

### 2. Create the environment file

Copy the example file:

```bash
cp .env.example .env.local
```

Add your development keys and database address to `.env.local`. Never commit this file.

### 3. Prepare the database

The app needs the `User` and `PrintRecord` tables defined in `prisma/schema.prisma`. For a new development database, run:

```bash
npx prisma db push
```

Only run this command against a development database unless you have reviewed the database change for another environment.

For an existing database, review and apply the SQL file in `prisma/migrations` through your normal release process. It adds OAuth ownership, anonymous-session ownership, and lookup indexes. It does not remove data.

### 4. Set up OAuth (optional)

Guests can use the app without OAuth. To let people sign in and sync their guest images:

1. Create a Clerk development instance.
2. Enable Google, GitHub, or both under Clerk's social connections.
3. Add the Clerk publishable key and secret key to `.env.local`.
4. Restart the app.

Clerk development instances can use Clerk's shared OAuth setup. Before a production launch, add your own provider credentials and callback addresses in Clerk.

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Restart the development server whenever you change an environment value.

## Environment settings

Most keys are server-only. The Clerk publishable key is intentionally public; all secret keys must stay on the server.

| Name | Required | Purpose |
| --- | --- | --- |
| `HF_TOKEN` | For FLUX and SDXL | Lets the app call Hugging Face image models. |
| `GEMINI_API_KEY` | For Gemini | Lets the app generate Gemini images and improve prompts. |
| `IPRINTR_DATABASE_URL` | Yes | Connects the running app to PostgreSQL. |
| `BLOB_STORE_ID` | With Vercel OIDC | Identifies the Vercel Blob store. OIDC is Vercel's short-lived sign-in method for services. |
| `VERCEL_OIDC_TOKEN` | With `BLOB_STORE_ID` | Gives short-lived access to the Blob store. Refresh it when it expires. |
| `BLOB_READ_WRITE_TOKEN` | Alternative Blob login | Can be used instead of the two OIDC settings above. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | For OAuth | Public key that loads Clerk sign-in. |
| `CLERK_SECRET_KEY` | For OAuth | Server secret used to verify OAuth sessions and read the signed-in profile. |

The app also accepts `IPRINTR_POSTGRES_URL`, `IPRINTR_PRISMA_DATABASE_URL`, `IPRINTR_PRISMA_URL`, and `POSTGRES_URL` as database address names.

For Blob storage, choose one setup:

1. `BLOB_STORE_ID` and `VERCEL_OIDC_TOKEN`, or
2. `BLOB_READ_WRITE_TOKEN`.

The store must be public because the browser displays the returned Blob URL directly.

## How image generation works

1. The browser sends the prompt and selected engine to `/api/generate`.
2. The server checks the request and confirms that storage is ready.
3. The server asks Hugging Face or Gemini to create the image.
4. The server uploads the image to Vercel Blob.
5. The server saves the prompt, engine, image URL, and user link in PostgreSQL.
6. The browser displays the image URL and adds it to the history list.

Guest users receive a random, HTTP-only cookie. The cookie value is never stored in the database. The app stores a SHA-256 hash of it with each guest image, so guest history survives reloads without exposing the session token to browser scripts.

When a guest signs in through OAuth, the server verifies the account, links the matching guest records to that user, and clears the anonymous owner from those records. Future images are saved directly to the account. The browser never sends or chooses a database user ID.

## Main folders

```text
src/app/                  Pages and shared styles
src/app/api/generate/     Image generation and Blob upload
src/app/api/optimize/     Prompt improvement
src/app/api/session/      Guest and signed-in session details
src/app/api/history/      Saved image history
src/app/sign-in/          OAuth sign-in page
src/app/account/          Signed-in account page
src/app/context/          Browser session and history state
src/lib/db.ts             PostgreSQL connection
src/lib/request-identity.ts  Guest cookie, OAuth identity, and history sync
src/proxy.ts              Clerk session checks
prisma/schema.prisma      Database table definitions
prisma/migrations/        Reviewed database changes
tests/                    Storage and database tests
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the local development server. |
| `npm run build` | Creates a production build and checks TypeScript. |
| `npm start` | Starts an already-built production version. |
| `npm run lint` | Checks the code for common problems. |
| `node --test tests/*.test.cjs` | Runs the storage and database tests. |
| `npx prisma db push` | Adds the current tables to the selected database. |

## Testing

Run the automated checks:

```bash
node --test tests/*.test.cjs
npm run lint
npm run build
```

The storage tests do not call paid image services. They use sample image data and controlled responses to check:

- Missing Blob settings
- OIDC and read/write-token access
- FLUX, SDXL, and Gemini image handling
- Blob upload failures
- Saved image URLs
- Supported database environment names
- HTTP-only anonymous sessions and hashed ownership
- Guest-to-account history sync

Before a release, also test one real image with development services:

1. Generate an image in the browser.
2. Confirm that the image appears.
3. Open the image URL and confirm that it loads.
4. Reload as a guest and confirm that the saved history returns.
5. Sign in with a test OAuth account and confirm the guest image still appears.
6. Generate another image while signed in, reload, and confirm both images return.

## Troubleshooting

### Image storage is not configured

The app could not find Blob login details. Set either the OIDC pair or `BLOB_READ_WRITE_TOKEN`, then restart the server.

### Image storage is unavailable

Check that the token belongs to the selected store, the token has not expired, and the store is public and active.

### Image generation fails before upload

Check the key for the selected image engine. Also check the provider's access rules, usage limit, and service status.

### The image appears but history is missing

Check the server log for a database error. Confirm that the database address is correct and that both tables from `prisma/schema.prisma` exist.

### OAuth buttons do not appear

Set both Clerk keys, enable at least one social connection in Clerk, and restart the development server. If either key is missing, the app stays in guest mode.

## Security notes

- OAuth identity is checked on the server through Clerk.
- Guest cookies are HTTP-only, use `SameSite=Lax`, and use `Secure` in production.
- PostgreSQL stores a one-way hash of the guest token, not the token itself.
- History and generation routes choose ownership from the server session. They do not accept a user ID from the browser.
- Public Blob images can be viewed by anyone who has their URL.

Add request limits before opening the app to the public. Image generation has a real cost, so limit requests by account, guest session, and network address.

## Deployment checklist

Before deploying:

1. Use separate production services and keys.
2. Add all required environment settings to the hosting project.
3. Confirm that the Blob store is public.
4. Review and apply the database migration to the production database.
5. Configure Clerk production keys and your own Google or GitHub OAuth credentials.
6. Add request limits.
7. Run the tests and production build.
8. Test guest generation, OAuth sync, storage, display, and history after deployment.

Never commit `.env`, `.env.local`, provider keys, database passwords, or Blob tokens.
