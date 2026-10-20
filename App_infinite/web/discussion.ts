/** Input rows are chronological. Keep each root followed by its chronological replies. */
export function discussionRows<T extends { comment: string; parent: string }>(comments: T[]): T[] {
  const replies = new Map<string, T[]>();
  for (const row of comments) {
    if (row.parent) {
      const thread = replies.get(row.parent) ?? [];
      thread.push(row); replies.set(row.parent, thread);
    }
  }
  return comments.filter(row => !row.parent).flatMap(root => [root, ...(replies.get(root.comment) ?? [])]);
}

export function replyCount(comments: { parent: string }[], comment: { comment: string; parent: string } | null): number {
  return !comment || comment.parent ? 0 : comments.filter(row => row.parent === comment.comment).length;
}
