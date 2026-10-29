# Infinite Plans

Infinite Plans (repository: **InifiniteWeek**) is an event-planning web app for MIT
students. Campus groups publish events, members decide which ones they are interested
in or going to, and everyone keeps their plans in one place: a personal event list and
a calendar. It was built for MIT 6.1040 (Software Design, Fall 2026).

## Features

- **Accounts:** sign up and log in with a username and password. Sessions are kept in
  an HttpOnly cookie.
- **Groups:** create a group that anyone can join (open) or that requires a member's
  approval. Members see the roster and pending requests, and can change the group's
  picture and admission policy. A sole member can delete the group. Every new database
  starts with an open **MIT Campus** group.
- **Private group events:** every event belongs to a group, and only current members can
  see it. Any member can publish an event with a title, time, location, description, and
  cover picture. Only its organizer can edit or cancel it.
- **Plans:** mark an event **Interested**, **Going**, or **Not going**. Interested and
  Going events appear in **My Events** and on the **Calendar** (month, week, and day
  views). Canceled events stay there with an "Event canceled" label.
- **Discussion:** members comment on events and reply in threads. Authors can edit their
  comments, and organizers can remove them.
- **Notifications:** an inbox for event time or location changes, cancellations, and
  discussion activity. Opening a notification goes straight to the event or the
  highlighted reply.

The [user journey](user_jouerney.md) walks through these features step by step with two
users, Keti and Tako, whose accounts, groups, and events already exist.

## Quick start

You need [Bun](https://bun.sh) 1.4.2, [Podman](https://podman.io) with Podman Compose
(for the local MongoDB), and macOS or Linux.

```sh
cd App_infinite
bun install
cp -n .env.example .env
podman machine start   # macOS only; run `podman machine init` once first
bun run dev
```

Then open **http://localhost:8080** (use `localhost`, not `127.0.0.1`, or the session
cookie will not work). See [App_infinite/README.md](App_infinite/README.md) for the
full instructions: stopping the app, resetting the database, the production preview,
tests, and deployment.

## Repository layout

| Path | Contents |
| --- | --- |
| [`App_infinite/`](App_infinite/) | The application. Run all app commands from here. |
| [`App_infinite/design/`](App_infinite/design/) | Markdown contracts: concept specifications, type bindings, and compositions |
| [`App_infinite/src/`](App_infinite/src/) | Backend: concept implementations, compositions, and the HTTP host |
| [`App_infinite/web/`](App_infinite/web/) | Vue frontend (pages, styles, fonts, icons, and the dev server) |
| [`App_infinite/tests/`](App_infinite/tests/) | Concept, composition, HTTP, frontend, and production tests |
| [`App_infinite/generated/`](App_infinite/generated/) | Files generated from the contracts (typed API wire format and a combined reference). Do not edit by hand. |
| [`App_infinite/LICENSES/`](App_infinite/LICENSES/) | ConceptBox attribution and font licenses |
| [`design.md`](design.md) | P1 design document: problem framing, pitch, concepts, and reactions |
| [`sketches/`](sketches/) | P1 hand-drawn UI sketches |
| [`user_jouerney.md`](user_jouerney.md) | Core user journey for the demo |
| [`Design Study Slides/`](Design%20Study%20Slides/) | Visual design study: slides, notes, and video link |
| [`package.json`](package.json) | Root scripts that forward `build`, `start`, and `preview` to `App_infinite/` for deployment |

## How it is built

The stack is [Bun](https://bun.sh), [MongoDB](https://www.mongodb.com),
[sync-engine](https://github.com/mit-sdg/sync-engine/tree/v1.1.0) 1.1.0, and
[Vue](https://vuejs.org) 3 with [Vite](https://vite.dev).

The app follows **concept design**: each concept is an independent piece of
functionality that owns its own state and knows nothing about the others.
Compositions connect them. Every concept and composition has a Markdown contract
in `App_infinite/design/` and a matching TypeScript module in `App_infinite/src/`, and
`bun run check` verifies that the two agree.

### Concepts

| Concept | Responsibility |
| --- | --- |
| Registering | Creates user identities with unique usernames |
| Authenticating | Stores password verifiers and checks passwords |
| Sessioning | Keeps people signed in, with idle and absolute expiry |
| Grouping | Groups, membership, join requests, and open or approval admission |
| EventPublishing | Group events, their details, organizers, pictures, and cancellation |
| EventMarking | Each person's Interested, Going, or Not going choice per event |
| Commenting | Threaded plain-text discussions |
| Notifying | Per-person inbox entries and whether they were read |

Concepts live in `App_infinite/src/concepts/<Name>/` and are generic over the identities
they reference; `design/types.md` binds them together (for example, every concept's
user is a `Registering.User`).

### Compositions

The compositions in `App_infinite/src/compositions/` (`accounts`, `passwords`, `access`,
`groups`, `events`, `plans`, `comments`, and `notifications`) define the API endpoints.
Each endpoint identifies the signed-in user through Sessioning, checks permissions
(for example, that the user is a member of the event's group), and then calls the
concepts. Reactions send notifications when events change or discussions get new
activity.

### Server and frontend

- `src/host/` serves `POST /api/*` and `GET /health`. It runs every request through one
  queue, so workflows never interleave. Request bodies are size-limited and time-limited
  before they enter the queue.
- `web/` is a single-page Vue app with hash-based routes (Explore, Groups, My Events,
  Calendar, Notifications, and event pages). It talks to the API through a client typed
  from `generated/wire.ts`, and reloads data after every change.
- In development, `web/server.ts` serves the page and forwards API calls to the backend.
  In production, Vite builds the frontend and a single Bun process serves both.

## Tests and checks

From `App_infinite/`, with MongoDB running (`bun run db:up`):

```sh
bun --env-file=.env.example test tests   # full suite; each test uses its own temporary database
bun run check:design                     # validate the design contracts
bun run check                            # contract/source agreement, generated files, TypeScript
```

The latest recorded results are in
[`App_infinite/tests/test-output.txt`](App_infinite/tests/test-output.txt).

## Deployment

The app deploys to [6.1040 Apps](https://61040.github.io/fa26/resources/deploying-apps/)
as one Bun process on port 3000 with a MongoDB add-on. The settings and checklist are in
[App_infinite/README.md](App_infinite/README.md#deploy-on-61040-apps).

## Design

- [P1 Design Document](design.md) and [sketches](sketches/)
- [Core user journey](user_jouerney.md)

### Design Study

Visual references (typography, color palettes, and textures) explored for the app's look and feel.

- [Design study slides and notes](Design%20Study%20Slides/README.md) ([PDF](Design%20Study%20Slides/Presentation1.pdf), [PowerPoint](Design%20Study%20Slides/Presentation1.pptx))
- [Design study video](https://mitprod-my.sharepoint.com/:v:/g/personal/ketip_mit_edu/IQB_o_IGwFvDSbwRYq5E_T9yAY6a5gXM5UjzVJ2nRmyBp08?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=6rtNmW) (MIT OneDrive/SharePoint)

## Credits

The account concepts and compositions, HTTP cookie and error handling, account tests,
and parts of the frontend's colors and layout are adapted from
[ConceptBox](https://github.com/mit-sdg/conceptbox) (MIT License; see [`App_infinite/LICENSES/ConceptBox.txt`](App_infinite/LICENSES/ConceptBox.txt)).
Bundled fonts are under the SIL Open Font License; their licenses are in
[`App_infinite/LICENSES/`](App_infinite/LICENSES/).
