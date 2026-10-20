import { afterEach, expect, test } from "bun:test";
import { CommentingConcept, CommentAlreadyExists, CommentNotFound, InvalidCommentText, NotCommentAuthor, type Comment } from "../../src/concepts/Commenting/Commenting.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import type { Db } from "mongodb";
afterEach(cleanupDatabases);
const first = new Date("2026-01-01T10:00:00Z"), later = new Date("2026-01-01T11:00:00Z");
const identity = (value: string) => value as Comment;

test("comment principle: trim, author-only edit, identical edit, permanent removal", async () => {
  const comments = new CommentingConcept<string, string>(await testDatabase());
  const comment = identity("comment");
  expect(await comments.post({ comment, author: "maya", subject: "event", text: "  Hello\nthere  ", at: first })).toEqual({ comment });
  expect(await comments._getComments({ subject: "event" })).toMatchObject([{ comment, text: "Hello\nthere", edited: false, createdAt: first }]);
  await expect(comments.revise({ comment, user: "other", text: "replace", at: later })).rejects.toThrow(NotCommentAuthor);
  await comments.revise({ comment, user: "maya", text: "Corrected", at: later });
  await comments.revise({ comment, user: "maya", text: " Corrected ", at: new Date("2026-02-01") });
  expect(await comments._getComment({ comment })).toMatchObject([{ text: "Corrected", author: "maya", subject: "event", createdAt: first, edited: true, editedAt: later }]);
  await comments.remove({ comment });
  expect(await comments._getComments({ subject: "event" })).toEqual([]);
  expect(await comments._getComment({ comment })).toEqual([]);
  await expect(comments.remove({ comment })).rejects.toThrow(CommentNotFound);
  await expect(comments.revise({ comment, user: "maya", text: "again", at: later })).rejects.toThrow(CommentNotFound);
});

test("invalid comment text and duplicate identities leave state unchanged", async () => {
  const comments = new CommentingConcept<string, string>(await testDatabase());
  for (const text of ["", " \n\t ", "x".repeat(2001)]) {
    await expect(comments.post({ comment: identity(crypto.randomUUID()), author: "maya", subject: "event", text, at: first })).rejects.toThrow(InvalidCommentText);
  }
  const comment = identity("valid");
  await comments.post({ comment, author: "maya", subject: "event", text: "x".repeat(2000), at: first });
  await expect(comments.post({ comment, author: "other", subject: "another", text: "overwrite", at: later })).rejects.toThrow(CommentAlreadyExists);
  await expect(comments.revise({ comment, user: "maya", text: " ", at: later })).rejects.toThrow(InvalidCommentText);
  expect(await comments._getComment({ comment })).toMatchObject([{ text: "x".repeat(2000), edited: false, author: "maya" }]);
});

test("comments persist across instances with stable ties and atomic concurrent creation", async () => {
  const database = await testDatabase();
  const comments = new CommentingConcept<string, string>(database), reopened = new CommentingConcept<string, string>(database);
  for (const [name, at] of [["z", first], ["a", first], ["new", later]] as const) {
    await comments.post({ comment: identity(name), author: "maya", subject: "event", text: name, at });
  }
  expect((await reopened._getComments({ subject: "event" })).map(row => row.comment)).toEqual(["a", "z", "new"].map(identity));
  expect(await reopened._getComments({ subject: "unknown" })).toEqual([]);
  const input = { comment: identity("race"), author: "maya", subject: "event", text: "race", at: later };
  const outcomes = await Promise.allSettled([comments.post(input), reopened.post(input)]);
  expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter(result => result.status === "rejected")).toMatchObject([{ reason: expect.any(CommentAlreadyExists) }]);
});

test("replies flatten under the root, persist, preserve references on edit, and delete with the thread", async () => {
  const db = await testDatabase(), comments = new CommentingConcept<string, string>(db);
  const root = identity("root"), reply = identity("reply"), nested = identity("nested"), keep = identity("keep");
  await comments.post({ comment: root, author: "maya", subject: "event", text: "Question", at: first });
  // Legacy roots need no migration.
  await db.collection("commenting.comments").updateOne({ _id: root as never }, { $unset: { parent: "" } });
  expect((await comments._getComment({ comment: root }))[0]?.parent).toBe("");
  await comments.reply({ parent: root, comment: reply, author: "ben", text: " Answer ", at: later });
  await comments.reply({ parent: reply, comment: nested, author: "maya", text: "Thanks", at: later });
  await comments.post({ comment: keep, author: "ben", subject: "event", text: "Separate", at: first });
  const reopened = new CommentingConcept<string, string>(db);
  expect(await reopened._getComment({ comment: nested })).toMatchObject([{ parent: root, subject: "event", author: "maya" }]);
  await comments.revise({ comment: reply, user: "ben", text: "Correction", at: later });
  expect(await comments._getComment({ comment: reply })).toMatchObject([{ parent: root, subject: "event", author: "ben", edited: true }]);
  expect(await comments._removalTargets({ comment: reply })).toEqual({ comments: [reply] });
  await comments.remove({ comment: reply });
  expect(await comments._getComment({ comment: nested })).toHaveLength(1);
  expect(await comments._removalTargets({ comment: root })).toEqual({ comments: [root, nested] });
  await comments.remove({ comment: root });
  expect(await comments._getComments({ subject: "event" })).toMatchObject([{ comment: keep }]);
  expect(await comments._removalTargets({ comment: root })).toEqual({ comments: [] });
  await expect(comments.reply({ parent: nested, comment: reply, author: "ben", text: "Again", at: later })).rejects.toThrow(CommentNotFound);
});

test("reply refusals and unauthorized edits preserve all comment state", async () => {
  const db = await testDatabase(), comments = new CommentingConcept<string, string>(db);
  const root = identity("root");
  await comments.post({ comment: root, author: "maya", subject: "event", text: "Question", at: first });
  const reply = identity("reply");
  await comments.reply({ parent: root, comment: reply, author: "ben", text: "Answer", at: later });
  const before = await db.collection("commenting.comments").find().toArray();
  for (const text of [" ", "x".repeat(2001)]) {
    await expect(comments.reply({ parent: root, comment: identity("bad"), author: "ben", text, at: later })).rejects.toThrow(InvalidCommentText);
  }
  await expect(comments.reply({ parent: identity("missing"), comment: identity("bad"), author: "ben", text: "Hi", at: later })).rejects.toThrow(CommentNotFound);
  await expect(comments.reply({ parent: root, comment: root, author: "ben", text: "Hi", at: later })).rejects.toThrow(CommentAlreadyExists);
  await expect(comments.revise({ comment: root, user: "ben", text: "Overwrite", at: later })).rejects.toThrow(NotCommentAuthor);
  await expect(comments.revise({ comment: reply, user: "maya", text: "Overwrite", at: later })).rejects.toThrow(NotCommentAuthor);
  expect(await db.collection("commenting.comments").find().toArray()).toEqual(before);
  // A stale/corrupt child must not provide a route around root validation.
  await db.collection("commenting.comments").deleteOne({ _id: root as never });
  const orphaned = await db.collection("commenting.comments").find().toArray();
  await expect(comments.reply({ parent: reply, comment: identity("bad"), author: "ben", text: "Hi", at: later })).rejects.toThrow(CommentNotFound);
  expect(await db.collection("commenting.comments").find().toArray()).toEqual(orphaned);
});

test("failed descendant deletion retains the root so the thread can be removed on retry", async () => {
  const db = await testDatabase(), comments = new CommentingConcept<string, string>(db);
  const root = identity("root");
  await comments.post({ comment: root, author: "maya", subject: "event", text: "Root", at: first });
  await comments.reply({ parent: root, comment: identity("reply"), author: "ben", text: "Reply", at: later });
  const failing = { collection: (name: string) => {
    const collection = db.collection(name);
    return new Proxy(collection, { get(target, key) {
      if (key === "deleteMany") return async () => { throw new Error("descendant deletion unavailable"); };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  } } as unknown as Db;
  await expect(new CommentingConcept<string, string>(failing).remove({ comment: root })).rejects.toThrow("descendant deletion unavailable");
  expect(await comments._getComment({ comment: root })).toHaveLength(1);
  expect(await comments._getComments({ subject: "event" })).toHaveLength(2);
  await comments.remove({ comment: root });
  expect(await comments._getComments({ subject: "event" })).toEqual([]);
});
