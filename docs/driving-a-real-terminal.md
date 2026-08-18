# Driving adiff in a terminal that is really there

The test driver renders adiff in memory. That catches almost everything, and it structurally cannot
catch the rest: how a real terminal routes a mouse event, which keys a protocol reports, what a
multiplexer swallows. Three bugs of that kind reached a release — the wheel being handled by the
text pane rather than by the review, a shift release the terminal was never asked to send, and a
clipboard escape tmux ate. Each was found by driving the built binary under a real pty.

## The harness

[terminal-control](https://github.com/anomalyco/terminal-control) runs a real terminal, sends exact
bytes, and reads the screen back as text, JSON cells or a picture.

```bash
cargo install --locked terminal-control        # needs zig 0.15.2 on PATH at build time
termctrl start probe --cols 120 --rows 30 -- ./run-adiff.sh
termctrl show probe                            # the settled screen as text
termctrl show probe --format json              # cells with colours, plus the cursor
termctrl save probe --format png --out shot.png
termctrl send probe text:j ctrl-p escape
printf '\033[<65;60;10M' | termctrl send probe --stdin   # a real wheel notch
termctrl stop probe
```

`bin/adiff.js` runs `dist/main.js`, so **build first**: a pty session tests the last `pnpm build`,
not the working tree. Three of the first reproductions in this repo were against a stale build and
proved nothing.

## Bytes worth sending

| gesture | bytes |
| --- | --- |
| wheel down / up | `\033[<65;X;YM` / `\033[<64;X;YM` |
| drag over lines | `\033[<0;X;YM`, `\033[<32;X2;Y2M`, `\033[<0;X2;Y2m` |
| option+left / cmd+left | `\033[1;3D` / `\033[1;9D` |
| shift+down | `\033[1;2B` |
| shift released | `\033[57441;1:3u` |

## When `termctrl start` will not start

The wrapper daemonises, and on this machine the spawn fails with "session daemon exited before
becoming ready" while the daemon itself runs perfectly. Start it by hand instead:

```bash
ADIFF_ROOT=<scratch> nohup termctrl __serve --name p1 --socket /private/tmp/termctrl-501/p1.sock \
  --cols 170 --rows 45 --cell-width 8 --cell-height 16 --max-bytes 4000000 \
  "$(readlink -f "$(which node)")" /path/to/adiff/bin/adiff.js review open --repo <repo> --branch <b> \
  >/tmp/p1.log 2>&1 </dev/null &
```

Two details are load-bearing. Without `</dev/null` the session starts, draws, and then ignores every
key — it looks like a keybinding bug and is not one. And the review must be launched through
`bin/adiff.js`, not `dist/main.js`: the wrapper passes `--experimental-ffi`, and without it OpenTUI
answers "native FFI is not available for this runtime yet" as JSON where the screen should be.

Point `ADIFF_ROOT` at a scratch directory. A probe writes comments, settles threads and marks files
read, and a real repository's review is not the place to leave that.

## Reading the caret

The cursor belongs to the terminal, not to a cell, so `--format json` reports it separately:

```bash
termctrl show probe --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["cursor"])'
```

## What to check here rather than in the suite

- Terminal modes taken and given back: the alternate screen, mouse tracking, the kitty flags.
- Anything routed by hit testing: wheel, drag, selection.
- Anything a protocol reports conditionally: key releases, alternate layouts, bracketed paste.
- Anything a multiplexer rewrites: the clipboard escape under tmux and screen.
