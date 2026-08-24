# The commands

Every adiff command answers in one line of JSON on stdout, takes the same options for saying which
branch it means, and reports a failure in the same shape. This page is that contract. `adiff describe`
prints the commands themselves, so nothing here lists them.

## One JSON line, and the one command that answers in none

A command that succeeds prints one line on stdout:

    adiff comment answer --worktree . --id c1 --body "Folded them into one InviteRejected."
    {"ok":true,"answered":1}

`ok` is always there, and the rest of the envelope is one key naming what the command is about:
`branches`, `comments`, `remarks`, `drafts`, `layers`, `reviewed`, `preferences`, and so on. `describe`
names that key for each command, so a caller knows where the payload sits before it runs anything.

`adiff review open` is the one command that answers in no JSON, because it opens the terminal.
`adiff upgrade` answers a person in plain text, and takes `--json` when a caller wants the envelope
instead. It is the only command that needs the flag.

## Address a branch

Every command that acts on a review takes either `--worktree <path>`, or `--repo <path>` with
`--branch <name>`. So the same command runs from your checkout and from the agent's worktree, and
standing in the branch `--worktree .` is enough.

`--branch` takes the name `branch list` reports. `--base <ref>` diffs the branch against that ref for
this one command, and `auto` asks for the stacked parent explicitly.

## Failures and exit codes

A failure goes to stderr, never stdout, so stdout is always safe to parse:

    {"ok":false,"error":{"type":"UnknownBranch","retriable":false,
     "suggestion":"Run `adiff branch list` for the branches that have something to review."}}

The exit code says what kind of problem it is: `2` the request was malformed, `3` the branch, file,
comment or remark does not exist, `1` something unexpected. Read `suggestion` first, because it names
the command that resolves the failure, and retry only when `retriable` is true.

## `--fields`

`--fields` keeps only the fields named, comma separated, so an answer stays small:

    adiff branch list --repo . --fields branch,files
    adiff layers show --worktree . --fields covered,partial,total,uncovered

An unknown field name is refused, and the failure names the fields the answer does carry.

## `adiff describe`

    adiff describe
    adiff describe --command 'comment send'

`describe` prints the catalog the commands themselves run on: every command with its options, which are
required, which take a value, which part of the loop it belongs to, whether it reads or writes, where
its payload sits, and an example. `adiff <command> --help` says the same for one command in plain text.
Both read the catalog the build is running, so neither goes out of date.

A misspelled command is refused with the nearest name adiff knows, and a noun with no verb after it is
refused with the verbs that noun has.

## From the command line

Two commands do from a shell what the terminal does with keys.

    adiff comment send --repo . --branch add-invitations \
      --file src/api/invitations.ts --start 12 --end 13 \
      --body "Three status checks in a row. One error shape would do."

`comment send` files one comment against a line range and hands it straight to the agent, exactly as
`ctrl+s` does. `--side` says which version the lines are on, `new` for the working tree and `old` for the
version being replaced, and defaults to `new`. `comment reply` continues a comment already sent, naming
it with `--to`.

    adiff comment list --repo . --branch add-invitations
    {"ok":true,"comments":[{"id":"1c43cb55","state":"answered","stale":false,
     "answers":[{"body":"Folded them into one InviteRejected.","asks":false}]}]}

`comment list` reports every comment on a review. `state` is where the thread stands, `stale` says the
branch has moved past the commit the comment was read at, and `answers` carries what the agent said, with `asks` true on an
answer that is a question back to you. `comment resolve`, `comment remove` and `comment restore` settle,
withdraw and reinstate one by id.

## Drafts on a pull request

When you are reading somebody else's pull request rather than an agent's branch, a comment is a draft of
what you will say on that pull request. Nothing reaches GitHub until you send it.

    adiff draft list --repo . --branch their-change
    adiff draft add  --repo . --branch their-change --file src/api.ts --start 40 --end 52 --body "…"
    adiff draft edit --repo . --branch their-change --id d1 --body "…"
    adiff draft drop --repo . --branch their-change --id d1
    adiff draft send --repo . --branch their-change

`draft add` anchors the same way `comment send` does. `draft send` posts every held comment to the pull
request as one review, under your name, and only you run it. An agent helping you draft writes the
wording and lists the drafts back; it never sends. Where GitHub confirms some of the comments and says
nothing about the rest, adiff reports `PartlySent`: what it confirmed is on the pull request, what it did
not is still held, and running the same send again sends only those.

## Next

- [The agent's side of the review](The-agent's-side-of-the-review), the three commands that are the loop.
- [When something goes wrong](When-something-goes-wrong).
