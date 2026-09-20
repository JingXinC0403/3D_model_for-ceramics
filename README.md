# Project CARE

A web app for monitoring artifacts stored in a sensor-equipped box. The box reports
to Blynk; each artifact recorded in the app carries its own ideal temperature and
humidity range, and the site warns when conditions drift outside what an artifact
can tolerate.

## Run it

```bash
npm install
npm start
```

Then open `http://localhost:3000` and create an account. Signing in takes you
straight to the box.

```bash
npm run dev
```

Same thing with auto-restart on file changes.

```bash
npm test
```

## The box

One installation monitors one box. Point it at your device by copying
`.env.example` to `.env` and filling in your Blynk token:

```
BLYNK_TOKEN=your-device-auth-token
BLYNK_REGION=blynk.cloud
CARE_BOX_NAME=CARE Box
```

`.env` is gitignored, so the token never reaches the repository. `npm start` loads
it automatically.

**With no token set, the site runs on synthetic readings** — so a fresh clone works
straight away, and `npm run mock` forces that mode even when a `.env` exists. Useful
for demos and for working on the interface without hardware.

Get your token from Blynk Console → Devices → your device → Device Info. The region
is the host in your Blynk Console URL, for example `sgp1.blynk.cloud`.

## Recording artifacts

**Record artifact** on the home page is the only thing you create in this app.
Pick a material to prefill typical storage limits, then adjust them. The box starts
judging its readings against those limits immediately.

The home page lists artifacts and their verdicts. **Open an artifact to see the
conditions around it** — the sensor readings and charts live on that page, and the
climate tiles are toned by that object's limits, so the same 47% humidity can read
green for one artifact and amber for another.

Artifacts describe what is physically in the box, so every signed-in account sees
the same list. Login gates access; it does not partition the data.

## Controls

Open an artifact and you get a **Servo** control with **Turn on** and **Turn off**.
It writes 0 or 1 to V6 — the Blynk button your ESP32 watches — and the state
indicator follows within a poll.

Two named buttons rather than one toggle, so a stale page can never send the
opposite of what you meant. V6 is the **only** writable pin: `server/sensors.js`
marks it `control: true` and everything else is rejected, whatever the request
looks like. Each press posts a CSRF-protected form.

To make another pin controllable, add `control: true` to it in `server/sensors.js`
and give it a group that is not in `GROUPS`.

## How warnings work

An artifact is **Suitable** when every reading sits inside its range, **Unsuitable**
when one falls outside, and **No reading** when the sensor has never reported. The
box takes the worst verdict among its artifacts, and a flame alarm outranks
everything.

A single box cannot always satisfy everything in it. Paper wants 45–55% RH and
metal wants 20–40% — store both together and one will always be unhappy. That is
a real conservation constraint, not a bug in the app.

## Datastreams

Set these up in Blynk Console → your template → Datastreams. The pins in
`server/sensors.js` must match.

| Pin | Sensor | Unit | Type |
|-----|--------|------|------|
| V0  | DHT22 temperature | °C | float |
| V1  | DHT22 humidity | % | float |
| V3  | Flame sensor | — | int 0/1 |
| V4  | Accelerometer X | g | float |
| V5  | IR sensor | — | int 0/1 |
| V6  | Servo on/off (control) | — | int 0/1 |
| V7  | Accelerometer Y | g | float |
| V8  | Accelerometer Z | g | float |
| V9  | Gyroscope X | °/s | float |
| V10 | Gyroscope Y | °/s | float |
| V11 | Gyroscope Z | °/s | float |

Only V0 and V1 drive artifact warnings. V3 raises the box alarm. V6 is a control
rather than a reading — see below. The rest are displayed. A pin that exists but has never been written shows as `--` rather than
`0`, and starts charting once the ESP32 pushes a value.

**Note on V3:** this board is active-low — it sends `1` when clear and `0` on
flame. `server/sensors.js` marks it `activeLow: true` and `normalizeReadings`
inverts it on arrival, so everything downstream can assume `1` means tripped.

If you later change the sketch to send `!digitalRead(FLAME_PIN)`, drop the
`activeLow` flag or the alarm inverts again.

## Changing the sensor set

Edit `server/sensors.js`. It holds the pin map, units, display groups, and which
pins carry the temperature and humidity used for artifact judgements. Both the
server and the browser read from it, so a change lands in one place.

`server/presets.js` holds the per-material starting ranges. They are conventional
museum-storage figures, not authority — a conservator's guidance for a specific
object always wins, and every value stays editable per artifact.

## Layout

```
server/index.js        app wiring
server/box.js          which Blynk device this installation watches
server/db.js           SQLite schema, migration, and queries (node:sqlite)
server/auth.js         scrypt password hashing, sessions, CSRF
server/blynk.js        Blynk client — server-side, so the token never reaches a browser
server/mock.js         synthetic readings
server/monitor.js      the warning logic: does this atmosphere suit these artifacts
server/sensors.js      pin map and display groups
server/presets.js      ideal ranges by material
server/routes/         auth, home, artifacts, readings API
server/views/          EJS templates
public/                stylesheet and browser modules
tests/                 57 tests
```

## Security notes

- Passwords are hashed with scrypt and a per-user salt. Sign-in failures are rate
  limited per email and never reveal whether an account exists.
- Session cookies are `httpOnly` and `sameSite=lax`; every state-changing form
  carries a CSRF token.
- The Blynk token is used only server-side. The browser talks to `/api/readings`,
  never to Blynk.

**This is built to run on your own machine.** It has no HTTPS, and `care.db` is an
unencrypted file holding account records. Do not expose the site to the internet
as-is.

## Not included

- Cameras. An ESP32-CAM serves MJPEG on the LAN and cannot be reached by a site
  running anywhere else, so it needs its own design — most likely the camera
  POSTing periodic snapshots to this server.
- Alerting when nobody is looking. Warnings appear on the page; there is no email,
  push, or stored breach history.
- The ESP32 sketch. The firmware that writes these pins is yours.
