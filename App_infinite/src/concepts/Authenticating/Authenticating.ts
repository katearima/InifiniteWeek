// Adapted from ConceptBox; see LICENSES/ConceptBox.txt.
import { password as passwordHash } from "bun";
import { type Collection, type Db, MongoServerError } from "mongodb";

export class InvalidPassword extends Error {}
export class PasswordSet extends Error {}
export class InvalidCredentials extends Error {}

interface VerifierDocument<User> {
  _id: User;
  verifier: string;
}

/** Lets people come back to their account by proving who they are with a password. */
export class AuthenticatingConcept<User extends string> {
  private readonly users: Collection<VerifierDocument<User>>;

  constructor(database: Db, name = "Authenticating") {
    this.users = database.collection(`${name.toLowerCase()}.users`);
  }

  async set({ user, password }: { user: User; password: string }) {
    if (!acceptable(password)) throw new InvalidPassword("A password must have 8 to 128 characters.");
    const verifier = await passwordHash.hash(password, { algorithm: "argon2id" });
    try {
      await this.users.insertOne({ _id: user, verifier });
    } catch (error) {
      if (isDuplicate(error)) throw new PasswordSet("This account already has a password.");
      throw error;
    }
    return { user };
  }

  async authenticate({ user, password }: { user: User; password: string }) {
    const found = await this.users.findOne({ _id: user });
    if (found === null || !(await passwordHash.verify(password, found.verifier))) {
      throw new InvalidCredentials("The username or password is incorrect.");
    }
    return { user };
  }

  async _acceptable({ password }: { password: string }) {
    return { acceptable: acceptable(password) };
  }
}

const acceptable = (password: string) => password.length >= 8 && password.length <= 128;

/** 11000 is the code MongoDB gives a write that breaks a unique index. */
const isDuplicate = (error: unknown) => error instanceof MongoServerError && error.code === 11000;
