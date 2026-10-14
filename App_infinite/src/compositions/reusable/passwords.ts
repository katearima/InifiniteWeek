// Adapted from ConceptBox; see LICENSES/ConceptBox.txt.
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";
import { inputs } from "./inputs.ts";

const { Registering, Authenticating, Sessioning } = concepts;

const Register = endpoint(
  "/auth/register",
  ({ username, password, user, session, expiresAt }) =>
    receive({ username, password }).then(
      where(Authenticating._acceptable({ password }).is({ acceptable: true }))
        .then(Registering.register({ username }).responds({ user }))
        .then(Authenticating.set({ user, password }).responds({}))
        .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
        .then(respond({ user, session, expiresAt }))
        .named("accepted"),
      where(Authenticating._acceptable({ password }).is({ acceptable: false }))
        .then(respond({ error: "INVALID_PASSWORD" }))
        .named("refused"),
    ),
  inputs({ username: "text", password: "text" }, false),
);

const SignIn = endpoint(
  "/auth/login",
  ({ username, password, user, session, expiresAt }) =>
    receive({ username, password }).then(
      where(Registering._byUsername({ username }).is({ user }))
        .then(Authenticating.authenticate({ user, password }).responds({}))
        .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
        .then(respond({ user, session, expiresAt }))
        .named("known"),
      where(no(Registering._byUsername({ username })))
        .then(respond({ error: "INVALID_CREDENTIALS" }))
        .named("unknown"),
    ),
  inputs({ username: "text", password: "text" }, false),
);

export const composition = { Register, SignIn };
