// Adapted from ConceptBox; see LICENSES/ConceptBox.txt.
import { type Collection, type Db, MongoServerError } from "mongodb";

export class InvalidUsername extends Error {}
export class UsernameTaken extends Error {}

const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;

export type User = string & { readonly __brand: "User" };

interface UserDocument {
  _id: User;
  username: string;
}

/** Lets people choose a username that others can find them by. */
export class RegisteringConcept {
  private readonly users: Collection<UserDocument>;
  private indexes: Promise<unknown> | undefined;

  constructor(database: Db, name = "Registering") {
    this.users = database.collection(`${name.toLowerCase()}.users`);
  }

  /** Reconfirm uniqueness before each registration, including after a database reset.
   * Share only an in-flight check; an index can disappear after a completed check.
   */
  #ready() {
    this.indexes ??= this.users
      .createIndex({ username: 1 }, { unique: true })
      .finally(() => { this.indexes = undefined; });
    return this.indexes;
  }

  async register({ username }: { username: string }) {
    if (!USERNAME.test(username)) {
      throw new InvalidUsername("A username must have 3 to 32 letters, digits, underscores, or hyphens.");
    }
    const user = crypto.randomUUID() as User;
    try {
      await this.#ready();
      await this.users.insertOne({ _id: user, username });
    } catch (error) {
      if (isDuplicate(error) && await this.users.findOne({ username })) throw new UsernameTaken("That username is taken.");
      throw error;
    }
    return { user };
  }

  async _byUsername({ username }: { username: string }) {
    const found = await this.users.findOne({ username });
    return found === null ? [] : [{ user: found._id }];
  }

  async _username({ user }: { user: User }) {
    const found = await this.users.findOne({ _id: user });
    return found === null ? [] : [{ username: found.username }];
  }
}

/** 11000 is the code MongoDB gives a write that breaks a unique index. */
const isDuplicate = (error: unknown) => error instanceof MongoServerError && error.code === 11000;
