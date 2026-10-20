import { type Collection, type Db, MongoServerError } from "mongodb";

export type Comment = string & { readonly __brand: "Comment" };
export type CommentCollection = Comment[];
export class InvalidCommentText extends Error {}
export class CommentNotFound extends Error {}
export class NotCommentAuthor extends Error {}
export class CommentAlreadyExists extends Error {}
interface CommentDocument<User, Subject> {
  _id: Comment; author: User; subject: Subject; text: string;
  createdAt: Date; edited: boolean; editedAt: Date; revision: number;
  parent?: string;
}
function commentText(text: string) {
  const trimmed = text.trim();
  if (!trimmed.length || trimmed.length > 2000) throw new InvalidCommentText("Write a comment of 1 to 2000 characters.");
  return trimmed;
}
export class CommentingConcept<User extends string, Subject extends string> {
  private readonly comments: Collection<CommentDocument<User, Subject>>;
  constructor(database: Db, name = "Commenting") {
    this.comments = database.collection(`${name.toLowerCase()}.comments`);
  }
  async post({ author, subject, text, comment, at }: { author: User; subject: Subject; text: string; comment: Comment; at: Date }) {
    if (await this.comments.findOne({ _id: comment })) throw new CommentAlreadyExists("This comment identity is already in use.");
    const value = commentText(text);
    try {
      await this.comments.insertOne({ _id: comment, author, subject, parent: "", text: value, createdAt: at, edited: false, editedAt: at, revision: 0 });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new CommentAlreadyExists("This comment identity is already in use.");
      throw error;
    }
    return { comment };
  }
  async reply({ author, parent, text, comment, at }: { author: User; parent: Comment; text: string; comment: Comment; at: Date }) {
    if (await this.comments.findOne({ _id: comment })) throw new CommentAlreadyExists("This comment identity is already in use.");
    const target = await this.comments.findOne({ _id: parent });
    if (!target) throw new CommentNotFound("There is no such comment.");
    const root = target.parent ? await this.comments.findOne({ _id: target.parent as Comment }) : target;
    if (!root || root.parent) throw new CommentNotFound("There is no such comment.");
    const value = commentText(text);
    try {
      await this.comments.insertOne({ _id: comment, author, subject: root.subject, parent: root._id,
        text: value, createdAt: at, edited: false, editedAt: at, revision: 0 });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new CommentAlreadyExists("This comment identity is already in use.");
      throw error;
    }
    return { comment };
  }
  async revise({ user, comment, text, at }: { user: User; comment: Comment; text: string; at: Date }) {
    for (;;) {
      const current = await this.comments.findOne({ _id: comment });
      if (!current) throw new CommentNotFound("There is no such comment.");
      if (current.author !== user) throw new NotCommentAuthor("Only the author can edit this comment.");
      const value = commentText(text);
      if (current.text === value) return {};
      const result = await this.comments.updateOne({ _id: comment, revision: current.revision, author: user },
        { $set: { text: value, edited: true, editedAt: at }, $inc: { revision: 1 } });
      if (result.matchedCount) return {};
    }
  }
  async remove({ comment }: { comment: Comment }) {
    const current = await this.comments.findOne({ _id: comment });
    if (!current) throw new CommentNotFound("There is no such comment.");
    // The application serializes reply/deletion workflows. Keep the root for retry
    // if descendant deletion fails; this is not a multi-document transaction.
    if (!current.parent) await this.comments.deleteMany({ parent: comment });
    if (!(await this.comments.deleteOne({ _id: comment })).deletedCount) throw new CommentNotFound("There is no such comment.");
    return {};
  }
  async _removalTargets({ comment }: { comment: Comment }): Promise<{ comments: CommentCollection }> {
    const current = await this.comments.findOne({ _id: comment });
    if (!current) return { comments: [] };
    const replies = current.parent ? [] : await this.comments.find({ parent: comment }).sort({ _id: 1 }).toArray();
    return { comments: [comment, ...replies.map(row => row._id)] };
  }
  async _getComment({ comment }: { comment: Comment }) {
    const row = await this.comments.findOne({ _id: comment });
    if (!row) return [];
    const { _id, revision, ...details } = row;
    return [{ ...details, parent: row.parent ?? "" }];
  }
  async _getComments({ subject }: { subject: Subject }) {
    return (await this.comments.find({ subject }).sort({ createdAt: 1, _id: 1 }).toArray())
      .map(({ _id, subject: _subject, revision, ...details }) => ({ comment: _id, ...details, parent: details.parent ?? "" }));
  }
}
