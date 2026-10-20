
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
