# Beer Darts

A touch-first darts scoreboard for **X01** and **Cricket**, with live checkout
suggestions. No build step, no dependencies — open `index.html` and play.

## Running it

Double-click `index.html`, or serve the folder and open it on the tablet you keep
by the board:

```sh
python -m http.server 8000     # then browse to http://<your-ip>:8000
```

Served over http(s) it registers a service worker, so once loaded it works with no
network. "Add to home screen" runs it fullscreen.

## X01

301 / 401 / 501 shortcuts, or **Custom** for any starting score from 101 to
1001 (so 701 and 901 are a couple of taps away);
double / master / straight out, optional double in, and a first-to-N-legs match.
Two ways to score, switchable mid-game from the menu:

- **Dart by dart** — pick `SINGLE`/`DOUBLE`/`TREBLE`, then the number. The
  multiplier drops back to `SINGLE` after each dart so a mis-tap costs one throw,
  not three. The remaining score counts down on every dart.
- **3-dart total** — type the visit and press `ENTER`, or tap a common score.
  Totals no three darts can make (179, 178, 176, …) are rejected. On a checkout
  it asks how many darts you used, so the average stays honest.

**Swipe the keypad left or right** to flip between the two entry modes without
opening the menu. A short, slow, or mostly-vertical drag is ignored, and the tap
underneath a swipe never registers as a throw.

The 3-dart quick row is all named scores: **Fuck All** (0), **🥓🍳**
breakfast (26), **🐟🍟** fish and chips (41), **🥜** bag o' nuts (45),
**🔥** sixty, **💯** a ton (100), **🔥🔥** one twenty and
**🔥🔥🔥** the maximum (180) — one flame per treble twenty. Each
carries its name in `aria-label`, so an emoji face is still announced.

Dart by dart gets **🥓🍳**, **🐟🍟** and **Fuck All**, and expands each into the
actual darts — 20-5-1 for a breakfast, 20-20-1 for fish and chips, three misses
for fuck all — so busts, checkouts and the dart count all stay correct. A
breakfast is definitionally 20-5-1; 41 has no canonical throw, so it uses the
common 20-20-1. The two scoring ones grey out once a turn is under way, since
they need all three darts.

Busts revert the whole turn: going below zero, leaving 1, or reaching zero without
a legal finishing dart. Undo steps back one dart at a time.

### Checkouts

The suggestion updates after **every dart**, for the darts you actually have left —
170 shows `T20 T20 BULL`, and after a T20 it becomes `T20 BULL`, then `BULL`. It
disappears the moment the leg can no longer be finished this turn.

Routes are searched rather than looked up in a table, then ranked the way a player
picks one: fewest darts first, then the quality of each throw (trebles over singles
over doubles; the bull is a last resort as a setup), then what each dart leaves —
which is why 99 comes out `T19 10 D16` (leaving 42) rather than `T20 7 D16`
(leaving an odd 39) — and finally which double you end on, in the usual
32/40/16/20/8 order of preference. Up to two alternative routes are shown underneath.

The seven bogey numbers (159, 162, 163, 165, 166, 168, 169) correctly show no out,
and the maximum finishes come out right: 170 double out, 180 master and straight.

## Cricket

20 down to 15 plus bull, or 20 down to 10 plus bull. Three variants:

- **Standard** — extra marks score while an opponent still has that number open.
  Close everything with the highest score to win.
- **Cutthroat** — extra marks give points to every opponent who has not closed
  that number. Lowest score wins.
- **No score** — first to close everything.

There are no turns. Either player's column is live at all times, so mark
whoever's dart just landed — no hand-off, no waiting. One tap is one mark, no
multiplier to pick first. A treble is three taps on the same number — "treble
20, 20, 20" (a treble plus two singles) is five taps on 20 in a row. Marks
render in the usual `/`, `X`, ringed-`X` notation, and a number closed by
everybody is struck through. Bull is one mark for the outer ring, two for the
bullseye, same as any other number now that there is nothing to select
beforehand. The number column sits between the players rather than off to one
side, so every column is right next to it.

## Touch details

Big targets throughout, no hover-dependent affordances, `touch-action: manipulation`
so there is no 300 ms tap delay or double-tap zoom, and the page itself never
scrolls. The screen is kept awake during a game via the Wake Lock API where it is
supported, taps give haptic feedback where available, and the layout reflows for
portrait, landscape and short screens. Games survive a reload — state is saved to
local storage after every dart.

**Landscape** rearranges X01 into two columns rather than stacking: score,
checkout and turn slots on the left, the whole keypad on the right. Landscape is
wide and short, so stacking wastes the width and starves the keypad of height.
The score scales up to fill its column, since that is the thing you read from the
oche. Cricket keeps its stacked layout — its grid already uses the full width.

## Older browsers

The scoreboard is aimed at whatever tablet is nearest the board, which in
practice can be old. An iPad mini 3, for instance, stops at iOS 12 / Safari 12,
which predates a lot of what this would otherwise use:

| Feature | Needs | Fallback here |
|---|---|---|
| `dvh` units | Safari 15.4 | `#app` height is measured in JS (`--app-h`) |
| `clamp()` | Safari 13.1 | a plain `px` `font-size` precedes every one |
| `inset` shorthand | Safari 14.1 | longhand `top/right/bottom/left` alongside it |
| flexbox `gap` | Safari 14.1 | `.no-flexgap` margins, set by a JS probe |
| `aspect-ratio` | Safari 15 | explicit height, upgraded under `@supports` |

The height one matters most: on iOS, `100vh` is the **toolbar-hidden** height, so
a `100vh` app runs off the bottom of the screen and the last keypad row hides
under the toolbar. Measuring `window.innerHeight` is the only thing every
browser agrees on.

Flexbox `gap` cannot be feature-detected in CSS — `@supports (gap: 1px)` is true
on older Safari because *grid* gap has been supported far longer — so
`App.detectFlexGap()` measures a probe element and sets a class.

`/diag.html` reports all of the above from the device itself, including how far
`100vh` overshoots the visible area.

Note that **service workers need a secure context**, so over plain `http://` on a
LAN address there is no offline cache and no stale-cache risk — every reload
fetches fresh.

## Deploying to k3s

There is nothing to compile, so the image is a single stage: nginx plus the static
files. It uses `nginx-unprivileged`, which listens on **8080 as uid 101**, so the
pod runs `runAsNonRoot` with a read-only root filesystem and all capabilities
dropped.

### Build

```sh
docker build -t beer-darts:0.1.0 .
```

Run it locally under the same constraints the pod applies:

```sh
docker run --rm -p 8080:8080 \
  --user 101:101 --read-only --cap-drop ALL \
  --tmpfs /tmp --tmpfs /var/cache/nginx \
  beer-darts:0.1.0
```

### Get the image onto the cluster

k3s uses containerd, not docker, so a locally built image is not visible to it.
Either push to a registry:

```sh
docker tag beer-darts:0.1.0 registry.example.com/beer-darts:0.1.0
docker push registry.example.com/beer-darts:0.1.0
```

…and set that name in `k8s/kustomization.yaml`; or side-load it onto each node,
which suits a home cluster with no registry:

```sh
docker save beer-darts:0.1.0 | ssh node1 'sudo k3s ctr images import -'
```

`imagePullPolicy: IfNotPresent` is set precisely so a side-loaded image is not
chased into a registry that has never heard of it.

### Apply

```sh
kubectl apply -k k8s/
kubectl rollout status deploy/beer-darts
```

Edit the host in `k8s/ingress.yaml` (it ships as `darts.local`) to whatever you
point at the cluster. The ingress targets k3s's bundled **Traefik**; for TLS,
switch the entrypoint annotation to `websecure`, uncomment the `tls` block, and
add a cert-manager issuer annotation.

To ship a new build, bump the tag in `k8s/kustomization.yaml` and re-apply — the
`images:` transform rewrites the deployment, and a changed tag is what triggers
the rollout.

### Caching

Filenames are not content-hashed, so `nginx/default.conf` serves everything
`no-cache` (revalidate, not "don't store") and lets ETags turn repeat visits into
304s — the whole app gzips to a few KB. `sw.js` additionally gets `no-store`,
without which a stale service worker would pin clients to an old build forever.
`.webmanifest` is absent from nginx's `mime.types`, so that one location sets
`application/manifest+json` explicitly.

`/healthz` backs the readiness and liveness probes so they do not depend on
`index.html`.

## Layout

```
index.html          markup and setup screen
styles.css          all styling
js/checkout.js      checkout search and ranking, out-mode rules
js/x01.js           X01 rules and rendering
js/cricket.js       Cricket rules and rendering
js/app.js           setup, persistence, menus, input wiring
sw.js               offline cache
Dockerfile          static image, nginx on 8080 as uid 101
nginx/default.conf  MIME types, caching and security headers
k8s/                deployment, service, Traefik ingress, kustomization
```

`js/checkout.js` has no dependencies and `x01.js` / `cricket.js` depend only on it
plus `UI.esc`, so the rules can be exercised headlessly in Node.
