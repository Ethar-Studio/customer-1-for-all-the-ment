# All Men Salon — Complete Guide (صالون لكل الرجال)

Everything you need to run, change, and deploy the barbershop website.

---

## Table of contents
1. [What this is](#1-what-this-is)
2. [⚠️ Things you still need to do](#2-️-things-you-still-need-to-do)
3. [The two logins](#3-the-two-logins)
4. [The pages](#4-the-pages)
5. [Firebase project](#5-firebase-project)
6. [Security rules (paste these)](#6-security-rules-paste-these)
7. [Run it on your computer](#7-run-it-on-your-computer)
8. [Deploy it live (Firebase Hosting)](#8-deploy-it-live-firebase-hosting)
9. [GitHub](#9-github)
10. [How to change things](#10-how-to-change-things)
11. [Barber availability (days off / limited hours)](#11-barber-availability-days-off--limited-hours)
12. [Costs](#12-costs)
13. [Troubleshooting](#13-troubleshooting)
14. [Where everything lives](#14-where-everything-lives)

---

## 1. What this is

A dark, editorial barbershop website for **All Men Salon / صالون لكل الرجال** in Al Khobar.

- **Languages:** Arabic (default, right-to-left) + English, one-click toggle in the header.
- **Tech:** plain HTML + CSS + JavaScript. No build step, no framework.
- **Backend:** Firebase — **Authentication** (logins) + **Firestore** (database).
- **What customers can do:** create an account, verify their email, and reserve a chair (pick barber → services → date & time → confirm).
- **What staff can do:** log in to an admin dashboard to see/manage all reservations and set barber days-off / limited hours.

---

## 2. ⚠️ Things you still need to do

These are the only open items. Everything else is built and tested.

- [ ] **Claim the admin account FIRST:** open `admin.html`, log in with username **`admin`** and **any password you choose** — the first login sets it permanently. Do this *before deploying* so nobody can claim it ahead of you. (Admin sign-up is public by design; whoever logs in first owns the password.)
- [ ] **Publish the security rules** so the email-verified gate is enforced on the server, not just the page: `firebase deploy --only firestore`. → [Section 6](#6-security-rules)
- [ ] **(Recommended) Turn on App Check** so nobody can bypass the site and hit the database directly with the SDK. → [Section 6b](#6b-app-check-stop-direct-database-abuse)
- [ ] **Deploy the site** so it has a real web address (don't run it from the Desktop long-term). → [Section 8](#8-deploy-it-live-firebase-hosting)

---

## 3. The two logins

### Customers — email + phone + password
- Sign up on `signin.html` with **name, email, phone, password**.
- Firebase emails them a **free verification link**. They must click it before they can book.
- The **phone is not verified** — it's just contact info so you can call/WhatsApp them. It shows in the admin dashboard.

### Admin/staff — username + password
- Log in on `admin.html` with a **username + password**.
- Allowed usernames are set in `js/firebase-config.js` → `window.ADMIN_USERNAMES` (default: `admin`).
- **First login claims the account:** the first time you sign in with an allowed username, the password you type becomes that account's password forever after.
- To add another staff login, add a username to that list (e.g. `["admin", "reception"]`) and have them log in once to set their password.

> Under the hood both use Firebase Email/Password auth (admins are mapped to `<username>@staff.forallmen.app`), so there are **no SMS costs**.

---

## 4. The pages

| File | What it is |
|---|---|
| `index.html` | Home — hero, live Google rating, reviews |
| `services.html` | Full price menu |
| `reserve.html` | Book a chair (needs sign-in + verified email) |
| `location.html` | Address + map |
| `hours.html` | Opening hours + "open now" indicator |
| `signin.html` | Customer sign in / create account |
| `account.html` | "My visits" — a customer's bookings + sign out |
| `admin.html` | Staff dashboard — **Reservations** tab + **Barbers** tab |

---

## 5. Firebase project

- **Project ID:** `cuntomer-1`
- **Console:** <https://console.firebase.google.com/project/cuntomer-1>
- **Keys** are already in `js/firebase-config.js` (safe to share — Firebase web keys are public by design; your data is protected by the rules, not by hiding the key).
- **What's on:** Authentication → Email/Password (enabled), Firestore Database (created).
- **Collections** (created automatically as the site is used):
  - `users` — one doc per customer/admin (name, email, phone)
  - `reservations` — one doc per booking
  - `availability` — one doc per barber (days off / limited hours)

---

## 6. Security rules

These are what actually protect your data. The live copy lives in the repo at
**`firestore.rules`** (with the composite index in `firestore.indexes.json`),
so the preferred way to publish them is one command:

```
firebase deploy --only firestore
```

That pushes both the rules and the index from the file — no copy-paste, and
the deployed rules always match what's in version control. (You can still
paste the block below into **Firestore Database → Rules → Publish** by hand if
you'd rather not use the CLI, but keep it in sync with `firestore.rules`.)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // an admin is the exact whitelisted staff account (keep in sync with ADMIN_USERNAMES)
    function isAdmin() {
      return request.auth != null &&
             request.auth.token.email in ['admin@staff.forallmen.app'];
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /reservations/{id} {
      // create: verified email, own uid, must start as 'pending',
      // and fields must be sane types (total is rendered by the admin
      // dashboard — it must be a number, never a string of HTML)
      allow create: if request.auth != null
                    && request.auth.token.email_verified == true
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.status == 'pending'
                    && request.resource.data.total is number
                    && request.resource.data.barberId is string
                    && request.resource.data.date is string
                    && request.resource.data.time is string
                    && request.resource.data.serviceIds is list
                    && request.resource.data.notes is string
                    && request.resource.data.notes.size() <= 500;
      // privacy: customers read only their own; admins read all
      allow read: if request.auth != null &&
        (resource.data.uid == request.auth.uid || isAdmin());
      // owners can only cancel upcoming bookings; the rest is admin-only
      allow update: if isAdmin() ||
        (request.auth != null && resource.data.uid == request.auth.uid
         && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
         && request.resource.data.status == 'cancelled'
         && resource.data.status in ['pending', 'confirmed']);
      allow delete: if isAdmin();
    }
    match /slots/{slotId} {
      // taken-times mirror (no personal data) + server-side double-booking block.
      // the doc id must match its contents so a slot can only claim the time it names
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.auth.token.email_verified == true
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.keys().hasOnly(['barberId', 'date', 'time', 'uid'])
                    && slotId == request.resource.data.barberId + '_' + request.resource.data.date + '_' + request.resource.data.time;
      allow delete: if isAdmin() ||
        (request.auth != null && resource.data.uid == request.auth.uid);
    }
    match /availability/{barberId} {
      allow read:  if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```

> If you add a second admin username, add its email here too, e.g.
> `['admin@staff.forallmen.app', 'reception@staff.forallmen.app']`.

---

## 6b. App Check (stop direct-database abuse)

The rules stop people reading data they shouldn't. **App Check** stops a
different attack: because the Firebase web key is public, someone technical can
skip your website entirely and poke the database directly with the SDK. App
Check makes Firestore reject any request that doesn't come from your real site.
It's free and strongly recommended, but **optional** — the site works without it.

Turn it on (about 5 minutes):

1. **Firebase console → App Check → Get started → Register** your web app with
   the **reCAPTCHA v3** provider. Copy the **site key** it gives you.
2. Paste that key into **`js/firebase-config.js`** →
   `window.APPCHECK_SITE_KEY = "…"` and **deploy the site** (`firebase deploy
   --only hosting`). Nothing enforces yet — this just starts sending tokens.
3. Give it a day, then **App Check → APIs → Cloud Firestore → Enforce.**

> Order matters: paste the key and deploy **before** you click Enforce. If you
> enforce with no key configured, the live site will start failing every read
> and write. Leaving `APPCHECK_SITE_KEY` empty keeps App Check off — safe default.

---

## 7. Run it on your computer

The site must be served over `http://`, **not** opened as a `file://` from the Desktop (Firebase is unreliable that way).

Easiest way — open a terminal in the project folder and run one of:

```
python -m http.server 8000
```
Then visit **http://localhost:8000**.

(Any static server works — `npx serve`, VS Code "Live Server", etc.)

---

## 8. Deploy it live (Firebase Hosting)

This gives you a real URL like `https://cuntomer-1.web.app`. One-time setup, then one command to update.

The config files (`firebase.json`, `.firebaserc`) are already in the project.

**One-time:**
```
npm install -g firebase-tools     (already installed on this machine)
firebase login                    (opens a browser — pick your Google account, click Allow)
```

**Deploy (run this any time you change the site):**
```
firebase deploy --only hosting
```

When it finishes it prints your live **Hosting URL** — that's the link you share with customers.

If you changed the security rules (`firestore.rules`) or the index
(`firestore.indexes.json`), push those too:
```
firebase deploy --only firestore
```
Or deploy everything — site + rules — at once with a plain `firebase deploy`.

---

## 9. GitHub

- **Repo:** <https://github.com/Ethar-Studio/customer-1-for-all-the-ment>
- The code is already pushed there.

**To save future changes to GitHub**, in the project folder:
```
git add -A
git commit -m "describe what you changed"
git push
```

---

## 10. How to change things

Almost everything you'd want to edit lives in **`js/data.js`** and **`js/i18n.js`**. After editing, refresh the site (and `firebase deploy` + `git push` if it's live).

| I want to change… | Edit | Notes |
|---|---|---|
| Barbers (names, roles, add/remove) | `js/data.js` → `BARBERS` | keep the `id` unique; each has `{en, ar}` name |
| Services / prices / durations | `js/data.js` → `SERVICES` | `price` in SAR, `min` = minutes |
| Opening hours | `js/data.js` → `HOURS` | `[open, close]` in 24h; `null` = closed. Day 0 = Sunday |
| Address / map / phone / Instagram | `js/data.js` → `LOCATION` | |
| Google rating / review count | `index.html` (hero) | search for `4.7` and `600 reviews` |
| Review quotes | `js/i18n.js` → `card.q1` / `card.q2` | both EN and AR blocks |
| Any wording on the site | `js/i18n.js` | every string, EN + AR |
| Colors / fonts | `css/styles.css` | the `:root { --… }` block at the top |
| Brand name | `js/i18n.js` → `brand` (EN + AR) | |
| Admin usernames | `js/firebase-config.js` → `ADMIN_USERNAMES` | also update the rules (Section 6) |
| Default language | `js/i18n.js` → `window.LANG = ... || 'ar'` | change `'ar'` to `'en'` |

---

## 11. Barber availability (days off / limited hours)

In `admin.html` → **Barbers** tab. For each barber you can:

- **Pause / resume** — a paused barber disappears from the booking page entirely.
- **Add a day off** — pick a date + "Off all day". Customers can't pick that barber that day (the date is crossed out).
- **Add limited hours** — pick a date + a "from–to" range. That day the barber only offers slots inside that range.
- Remove any entry with the ✕ button.

Changes appear on the customer booking page immediately. Services are fixed (not editable from the admin) — change them in `js/data.js`.

---

## 12. Costs

- **Everything currently used is free** on Firebase's Spark plan: Email/Password login, email verification, and Firestore (generous free limits — far more than a barbershop needs).
- **SMS phone verification is NOT set up** (you chose email verification instead). If you ever want real SMS codes, that needs the paid **Blaze** plan (a card on file) and costs per message — just ask.

---

## 13. Troubleshooting

| Symptom | Cause & fix |
|---|---|
| Site hangs / bookings won't load | Firestore unreachable — check the database exists and the rules are published (Section 6). The site is built to time out after 8s rather than freeze. |
| "Check your inbox" won't go away | The customer hasn't clicked the email link. Tell them to check spam, then press **"I've verified."** They can resend from that screen. |
| A customer says booking is blocked | Their email isn't verified yet — that's intended. Verified accounts book normally. |
| Admin login fails | Username must be in `ADMIN_USERNAMES`. Remember the **first** login sets the password — if you forget it, delete that user in Console → Authentication → Users, then log in again to re-set it. |
| Verification emails not arriving | Check spam. The sender is `noreply@cuntomer-1.firebaseapp.com`. |
| Login/booking works on `localhost` but not from the Desktop file | Serve over `http://` or deploy (Sections 7–8). Firebase doesn't like `file://`. |

---

## 14. Where everything lives

```
customer website 1/
├── index.html            Home
├── services.html         Price menu
├── reserve.html          Booking flow
├── location.html         Address + map
├── hours.html            Opening hours
├── signin.html           Customer login
├── account.html          My visits
├── admin.html            Staff dashboard
├── css/
│   └── styles.css        All styling (colors/fonts at the top)
├── js/
│   ├── firebase-config.js  Firebase keys + admin usernames
│   ├── data.js             Barbers, services, prices, hours, address
│   ├── i18n.js             Every English + Arabic string
│   ├── store.js            Login + database logic
│   └── app.js              Shared header/footer + language toggle
├── firebase.json         Hosting + Firestore config
├── firestore.rules       Security rules (deploy with: firebase deploy --only firestore)
├── firestore.indexes.json  Composite index for the booking calendar
├── .firebaserc           Points to project cuntomer-1
├── README.md             Short readme
└── GUIDE.md              This file
```

---

*Questions or changes? Everything is editable — the two files you'll touch most are `js/data.js` (shop info) and `js/i18n.js` (wording).*
