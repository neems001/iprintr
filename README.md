# iprintr

iprintr is a web app for creating images from text. A user writes a description, chooses an image engine, and receives a generated image. The app saves generated images in Vercel Blob and can save image history in PostgreSQL.

## What the app can do

- Generate realistic images with FLUX.
- Generate artwork with SDXL.
- Generate images with Gemini.
- Improve a short prompt before generation.
- Let guests generate images without creating an account.
- Save image history for users in PostgreSQL.
- Store generated image files in a public Vercel Blob store.

## Current project status

Image generation, Blob storage, database storage, and image display work locally with development services.

The current email login is only a demo. It does not use passwords, email checks, or secure server sessions. Do not use it as production authentication. See [Security notes](#security-notes) before deploying the app for real users.

## Requirements

Install or create the following before starting:

- Node.js 20.9 or newer
- npm
- A PostgreSQL database
- A public Vercel Blob store
- A Hugging Face access token for FLUX and SDXL
- A Gemini API key for Gemini images and prompt improvement

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

The app needs the `User` and `PrintRecord` tables defined in `prisma/schema.prisma`.

Prisma commands currently read `IPRINTR_URL`. Add it to your local environment file with the same value as `IPRINTR_DATABASE_URL`, then run:

```bash
npx prisma db push
```

Only run this command against a development database unless you have reviewed the database change for another environment.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Restart the development server whenever you change an environment value.

## Environment settings

All keys are used on the server. Do not add `NEXT_PUBLIC_` to their names because that would expose them to the browser.

| Name | Required | Purpose |
| --- | --- | --- |
| `HF_TOKEN` | For FLUX and SDXL | Lets the app call Hugging Face image models. |
| `GEMINI_API_KEY` | For Gemini | Lets the app generate Gemini images and improve prompts. |
| `IPRINTR_DATABASE_URL` | Yes | Connects the running app to PostgreSQL. |
| `IPRINTR_URL` | For Prisma commands | Uses the same database address when running Prisma tools. |
| `BLOB_STORE_ID` | With Vercel OIDC | Identifies the Vercel Blob store. OIDC is Vercel's short-lived sign-in method for services. |
| `VERCEL_OIDC_TOKEN` | With `BLOB_STORE_ID` | Gives short-lived access to the Blob store. Refresh it when it expires. |
| `BLOB_READ_WRITE_TOKEN` | Alternative Blob login | Can be used instead of the two OIDC settings above. |

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

Guest users can generate images without logging in. Their on-screen history is temporary and disappears after a reload. Signed-in users have history saved in PostgreSQL, subject to the security limitation described below.

## Main folders

```text
src/app/                  Pages and shared styles
src/app/api/generate/     Image generation and Blob upload
src/app/api/optimize/     Prompt improvement
src/app/api/auth/         Demo login
src/app/api/history/      Saved image history
src/app/context/          Browser login and history state
src/lib/db.ts             PostgreSQL connection
prisma/schema.prisma      Database table definitions
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

Before a release, also test one real image with development services:

1. Generate an image in the browser.
2. Confirm that the image appears.
3. Open the image URL and confirm that it loads.
4. Sign in with a test user and generate another image.
5. Reload the page and confirm that the saved history returns.

## Troubleshooting

### Image storage is not configured

The app could not find Blob login details. Set either the OIDC pair or `BLOB_READ_WRITE_TOKEN`, then restart the server.

### Image storage is unavailable

Check that the token belongs to the selected store, the token has not expired, and the store is public and active.

### Image generation fails before upload

Check the key for the selected image engine. Also check the provider's access rules, usage limit, and service status.

### The image appears but history is missing

Check the server log for a database error. Confirm that the database address is correct and that both tables from `prisma/schema.prisma` exist.

### Prisma cannot find the database address

Prisma commands use `IPRINTR_URL`. Set it to the same address as `IPRINTR_DATABASE_URL` before running a Prisma command.

## Security notes

The current login and history system is not ready for production:

- Login accepts an email address without proving that the user owns it.
- The browser stores the user object in local storage.
- History requests accept a user ID from the browser.
- A person who learns another user's ID could request that user's history.
- Public Blob images can be viewed by anyone who has their URL.

Before a public launch, add real server-side authentication. The server should read the user ID from a trusted session cookie instead of accepting it from the request. Guest generation can remain available without login.

Also add request limits before opening the app to the public. Image generation has a real cost, so limit requests by account, guest session, and network address.

## Deployment checklist

Before deploying:

1. Use separate production services and keys.
2. Add all required environment settings to the hosting project.
3. Confirm that the Blob store is public.
4. Review and apply the database change to the production database.
5. Replace the demo login with secure authentication.
6. Add request limits.
7. Run the tests and production build.
8. Generate one test image after deployment and confirm storage, display, and history.

Never commit `.env`, `.env.local`, provider keys, database passwords, or Blob tokens.
