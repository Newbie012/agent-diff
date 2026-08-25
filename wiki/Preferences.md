`,` opens the preferences from the branch list or from inside a branch. `j` and `k` move between them,
`return` or space turns one on or off, and `escape` closes them. Each one carries the sentence saying
what it does.

![The preferences, each with the sentence saying what it does](https://github.com/user-attachments/assets/beb09d71-a298-49a7-b656-f2e283a28d96)

## The eight toggles

| Preference | On by default | What it does |
| --- | --- | --- |
| Wrap long lines | no | Long lines wrap instead of running off the edge |
| Keep the heading in view | yes | The class or function you are inside stays pinned as you scroll |
| Show the review panel | yes | Comments sit in their own pane beside the diff |
| Hide files already read | no | The file list shows only what you have not read yet |
| Hide threads already settled | no | The review panel shows only threads still open |
| Read the newest comment first | yes | The newest comment sits at the top of the panel |
| Read the pull request's review | no | The review shows the remarks left on the branch's pull request |
| Hold comments until you send them | no | Comments wait until you send them together, rather than going one at a time |

"Read the pull request's review" is what turns [Remarks](Remarks) on, and it is off until you ask, so
adiff reads no pull request on its own. "Hold comments until you send them" is what
[Comments](Comments) means by holding.

## The editor is not a toggle

A preference is on or off, and your editor is neither, so it is not in this list. `e` in the diff opens
the line you are on in `$VISUAL`, `$EDITOR`, or the `editor` command in the settings file. With none of
them set, `e` offers the editors it found on your `PATH` and `E` changes the choice later, so the
settings file is somewhere adiff writes rather than somewhere you edit. [The diff](The-diff) has both
keys.

## From the command line

    adiff config list
    adiff config get --name sticky
    adiff config set --name hold --value on

`config list` reports all eight with their values and what each does. A preference is on or off, so
`--value` takes `on` or `off`.

## What carries between sessions

A preference holds for every repository on this machine. adiff keeps it, and the whole review, in its own
store at `~/.adiff`, and writes nothing into your repository. `ADIFF_ROOT` moves that store somewhere
else.

Quitting costs you nothing that was written. Open the same branch again and you have every comment and
answer, the threads you settled, the comments you removed, the files you marked reviewed, the layers the
agent published, the remarks you dismissed, and your preferences.

One thing does not carry: comments you are holding rather than sending are only in this session. `ctrl+c`
says how many were never sent before it leaves, and they are gone when you come back. Send them with `C`
first.

## Read next

- [Install](Install), for `ADIFF_ROOT` and the rest of the environment variables.
- [The diff](The-diff), for the keys the display preferences change.
