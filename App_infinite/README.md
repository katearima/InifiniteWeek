# Infinite Plans

Local development and production use Bun 1.4.2. Run application commands from
`App_infinite/`; the repository root also forwards `build`, `start`, and `preview`.
## First-time setup

Install Bun, Podman, and Podman Compose. From the repository root:

```sh
cd App_infinite
bun install
cp -n .env.example .env
```

The copy command keeps an existing `.env`. The example settings use the local MongoDB container.

On macOS, if you have never created a Podman machine:

```sh
podman machine init
```

## Run the app

Run these commands from `App_infinite/`:

```sh
podman machine start
bun run dev
```

If Podman is already running, skip the first command. `bun run dev` starts MongoDB, the backend, and the Vue frontend, and watches for code changes.

Open **[http://localhost:8080](http://localhost:8080)**. Use `localhost`, not `127.0.0.1`, so the session cookie and origin checks work. Keep the terminal open.

`bun run up` is an alias for this watched development workflow. App logs appear
in that terminal; `bun run logs` / `bun run db:logs` show MongoDB logs.

If you see **EADDRINUSE**, another server is using port 8080 or 4000. Stop the existing app with **Ctrl+C** in its terminal before starting another copy. A previous `bun run start` backend does not reload code changes; leaving it running can mean you are testing old code even after launching `dev`.

## Stop the app

Press **Ctrl+C** in the app terminal. Your saved data remains available next time.

To stop MongoDB too, run:

```sh
bun run down
```

This preserves the database data.

## Start with an empty database

**This permanently deletes all data in this project's local MongoDB volume, including accounts, groups, events, and saved plans.** These commands apply to the default local setup in `.env.example`.

First stop any running app servers with **Ctrl+C**. With Podman running, execute from `App_infinite/`:

```sh
bun run db:reset
bun run dev
```

Refresh [http://localhost:8080](http://localhost:8080) and create a new account. The app automatically creates an open **MIT Campus** group. New accounts can join it from Groups. No accounts or events are added automatically.

## Production preview

```sh
bun run preview
```

This starts the local database if needed, builds the existing Vue frontend with
Vite, and starts one Bun process serving both the built pages and the API.
Open **http://localhost:3000** and **http://localhost:3000/health**. The latter
must return `{"status":"ok"}`. Stop the preview with Ctrl+C.

Stop other app servers connected to the same database before previewing.
Preview uses `MONGODB_URL` from your local environment; it does not reset data.
The app uses hash navigation, so reloading a URL such as `/#calendar` keeps
that view. Production requires `bun run build` before starting with
`NODE_ENV=production`; the platform supplies that environment setting.

For an isolated check using temporary databases on the documented local MongoDB
server, run:

```sh
bun run check:design
bun run check
bun --env-file=.env.example test tests
```

The production test builds through the root script, starts the production server
on an unused port, and verifies account, plan, and picture persistence after
restarting it. Tests clean up only their uniquely named databases. If your local
MongoDB uses different credentials, set `MONGODB_TEST_URL` accordingly.

## Deploy on 6.1040 Apps

Follow the [course deployment guide](https://61040.github.io/fa26/resources/deploying-apps/).
Commit and push the tested changes and `App_infinite/bun.lock`. Keep `.env`,
`dist`, installed dependencies, and the local demo recording out of Git.

Sign in at [mit-sdg.dev](https://mit-sdg.dev), then create `infiniteweek` if that
name is available. Names are permanent. Use these settings:

| Setting | Value |
| --- | --- |
| Repository | `https://github.com/katearima/InifiniteWeek` |
| Branch | `main` |
| Runtime | Bun |
| Package directories | `App_infinite` (only this directory needs dependency installation) |
| Build script | `build` |
| Start script | `start` |
| Port | `3000` |
| Health check | `/health` |

The root package pins Bun 1.4.2 and forwards the scripts into `App_infinite/`.
Build runs Vite under Bun; the runtime needs no Node.js, Vite server, or Podman.

Add MongoDB and choose **MONGODB_URL** for its connection variable. Wait for
database setup to finish, then set **PUBLIC_ORIGIN** to
`https://infiniteweek.mit-sdg.dev` (no trailing slash). If you chose another app
name, use its address instead. The platform supplies `HOST`, `PORT`, and
`NODE_ENV`; do not copy local database credentials or the local `.env` there.
Pictures already live in MongoDB, so this implementation does not need S3.

Select the tested commit in Deploy, review it, and deploy. After success, check
`/health`, signup/login, event creation, picture upload, and reload persistence.
The new database starts empty apart from the default MIT Campus group; local
accounts and events are not migrated. Do not run multiple app instances against
the same database. For later deployments, stop the old app before deploying the
new commit so the platform's normal overlapping rollout cannot create two
writers; expect brief downtime. Starting/redeploying retains the database.

Request bodies are bounded before entering the shared workflow queue. A stalled
upload times out without blocking other requests; once concept work is admitted,
caller timeout or cancellation does not let another workflow interleave with it.
