# Deciding what goes into a memory store

The MCP lets an assistant store memories; it doesn't decide what's worth
storing. Answer these questions once per store — personal, work, a single
project, a team — and write the result where the assistant reads its
instructions (your global CLAUDE.md, or a project's CLAUDE.md for a project
store). Revisit them when the review queue feels noisy or empty.

## 1. Purpose
Who reads this store, and which answers should it improve? Name two or three
concrete situations ("stops asking which stack I use"). If a memory would never
change an answer, it doesn't belong.

## 2. Scope
- Which areas are in?
- Which are out, even when they come up naturally?
- What is allowed but must be `secret`/`sensitive` — stored, never returned by
  the read tools?

## 3. Durability
Only settled facts, or also moving state like current projects and goals?
Moving state needs an end: set `valid_to`, or supersede it when it changes.

## 4. Granularity
One memory per topic. Search first, and extend an existing memory via
`supersedes` instead of adding a near-duplicate. Split only when a memory mixes
unrelated topics.

## 5. Other people
Never, only where relevant to the owner's work, or freely? Anything about a
third party is their data too — when in doubt, leave it out.

## 6. Separation
Does this belong in its own store? Separate when the audiences differ (work vs.
private), when the machine is managed by someone else, or when the store will be
shared. `PERSONAL_MEM_DB` makes that a single setting.

## 7. Review load
How eager should suggestions be? Aim for a queue you actually read. Approving
everything unread means the rules are too broad; an empty queue for weeks means
they're too narrow.

## Writing it down
Three short lists: **always capture**, **never capture**, **ask first**.

### Examples
| | Personal | Work | Project |
|---|---|---|---|
| Always | tooling & setup, communication preferences, long-running goals | team conventions, decisions and their reasons, recurring workflows | decisions not written down elsewhere, gotchas, who owns what (roles) |
| Never | health, finances, other people's private matters | customer data, colleagues' personal details | anything already in the README, ADRs or git history |
| Ask first | current projects | org structure, project status | roadmap and dates |
