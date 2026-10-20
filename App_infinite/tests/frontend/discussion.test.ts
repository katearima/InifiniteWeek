import { expect, test } from "bun:test";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { discussionRows, replyCount } from "../../web/discussion.ts";
import { parseRoute, routeHash } from "../../web/navigation.ts";

test("one-level threads group chronological replies without moving roots or nesting reply-to-reply", () => {
  const comments = [
    { comment: "first", parent: "" }, { comment: "second", parent: "" },
    { comment: "reply1", parent: "first" }, { comment: "reply2", parent: "first" },
    { comment: "reply3", parent: "second" },
  ];
  expect(discussionRows(comments).map(row => row.comment)).toEqual(["first", "reply1", "reply2", "second", "reply3"]);
  expect(replyCount(comments, comments[0]!)).toBe(2);
  expect(replyCount(comments, comments[2]!)).toBe(0);
  expect(replyCount(comments, null)).toBe(0);
});

test("comment destinations encode safely and retain exact targets within the same event", () => {
  for (const comment of ["first", "reply", "space & ? / #"]) {
    expect(parseRoute(routeHash("event", "event", comment))).toEqual({ page: "event", id: "event", comment });
  }
  expect(parseRoute("#explore")).toEqual({ page: "explore", id: "", comment: "" });
  expect(parseRoute("#event/event")).toEqual({ page: "event", id: "event", comment: "" });
  expect(parseRoute("#groups?comment=ignored").comment).toBe("");
  expect(parseRoute("#event/%broken").id).toBe("");
});

test("discussion renders escaped bubbles, one reply indentation, and a focused-target highlight", async () => {
  const html = await Bun.file(new URL("../../web/index.html", import.meta.url)).text();
  const template = html.match(/<section class="discussion"[\s\S]*?<\/section>/)?.[0];
  expect(template).toBeDefined();
  const base = { author: "someone", username: "Maya", text: "<script>unsafe</script>\nHello", createdAt: "2026-10-19", edited: false, canEdit: false, canRemove: false };
  const comments = [{ ...base, comment: "root", parent: "" }, { ...base, comment: "reply", parent: "root" }];
  const rendered = await renderToString(createSSRApp({
    template, components: { "app-icon": { render: () => null } },
    setup: () => ({
      comments, threadedComments: discussionRows(comments), event: { canceled: false }, me: { user: "me" },
      highlightedComment: "reply", editingComment: "", replyingTo: "root", replyText: "", commentText: "", busy: false,
      date: (value: string) => value, time: () => "12:00",
    }),
  }));
  expect(rendered).toContain('id="comment-reply"');
  expect(rendered).toContain("reply highlighted comment-entry");
  expect(rendered).toContain('tabindex="-1"');
  expect(rendered).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
  expect(rendered).not.toContain("<script>");
  expect(rendered).toContain("Post reply");
  expect(rendered).toContain("Cancel reply");
  expect(rendered).not.toContain("Edit comment");
});

test("thread deletion warning explicitly includes other authors' replies and notification cleanup", async () => {
  const html = await Bun.file(new URL("../../web/index.html", import.meta.url)).text();
  const template = html.match(/<template v-else-if="modal === 'comment-delete'">([\s\S]*?)<\/template>/)?.[1];
  expect(template).toBeDefined();
  const rendered = await renderToString(createSSRApp({
    template,
    setup: () => ({ pendingComment: { username: "Maya", text: "Root" }, pendingReplyCount: 2, busy: false }),
  }));
  expect(rendered).toContain("all 2 replies, including replies by other people");
  expect(rendered).toContain("notifications will also be removed");
});
