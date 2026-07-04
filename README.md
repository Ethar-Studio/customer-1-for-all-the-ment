# All Men Salon (صالون لكل الرجال) — Barber Reservation Site

Dark editorial barbershop website with a full reservation system, phone + password accounts, and an admin dashboard. English / Arabic (RTL) with one-click toggle.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home — hero, live reviews card, barbers, services teaser |
| `services.html` | Full service menu with prices and durations |
| `reserve.html` | Reserve a chair: barber → services → date & time → confirm (**requires sign-in**) |
| `location.html` | Address, landmark, parking, embedded map |
| `hours.html` | Weekly schedule with a live "Open now / Closed now" pill |
| `signin.html` | Customer sign in / create account (**email + password**, with free email verification) |
| `account.html` | My visits — past & upcoming reservations, cancel, sign out |
| `admin.html` | Staff dashboard (**username + password login**). Two tabs: **Reservations** (stats, search/filter, confirm/cancel/delete, CSV export) and **Barbers** (pause a barber, mark days off, set limited hours — reflected live on the booking page) |

## Two logins

- **Customers** sign in with their **email + password** on `signin.html`, and must click a **free Firebase verification link** before they can book (enforced in the UI *and* in the Firestore rules).
- **Staff/admin** sign in with a **username + password** on `admin.html` (mapped internally to `<username>@staff.forallmen.app`).

Both run on Firebase's "Email/Password" auth, so there are no SMS costs.

The allowed admin usernames are listed in `window.ADMIN_USERNAMES` in [js/firebase-config.js](js/firebase-config.js) (default: `admin`). **The first time** you sign in on `admin.html` with an allowed username, the password you type becomes that admin's password. After that, it just signs you in.

## Firebase setup (project `cuntomer-1`)

The live keys are already in [js/firebase-config.js](js/firebase-config.js). Two things must be turned on in the [Firebase console](https://console.firebase.google.com):

1. **Authentication → Sign-in method → Email/Password → Enable.**
2. **Firestore Database → Create database** → **Production mode** → pick a location → Create.

Then paste the rules below into **Firestore → Rules** and **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // exact whitelist — must match ADMIN_USERNAMES in js/firebase-config.js
    // (never use a wildcard here: account signup is public, so anyone could
    //  register an unlisted @staff... email and become admin)
    function isAdmin() {
      return request.auth != null &&
             request.auth.token.email in ['admin@staff.forallmen.app'];
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /reservations/{id} {
      // must have a VERIFIED email to create a booking (server-side gate)
      allow create: if request.auth != null
                    && request.auth.token.email_verified == true
                    && request.resource.data.uid == request.auth.uid;
      allow read:   if request.auth != null;
      // owners can cancel their own; admins manage everything
      allow update, delete: if request.auth != null &&
        (resource.data.uid == request.auth.uid || isAdmin());
    }
    match /availability/{barberId} {
      // customers read barber day-off / limited-hours; only admins edit it
      allow read:  if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```

> These rules are what actually protect the data. To add another admin, add the username to `ADMIN_USERNAMES` — the `@staff.forallmen.app` rule already covers it.

## Running

Open the site over `http://` (not `file://`) so Firebase connects cleanly — e.g. `python -m http.server` in this folder, or deploy to **Firebase Hosting**. The included `.claude/launch.json` already serves it on port 8734.

## Running locally

Just open `index.html` in a browser — no build step, no dependencies. (Fonts and the map load from the internet.)

## Where things live

- `css/styles.css` — the whole theme (colors/fonts are CSS variables at the top)
- `js/data.js` — barbers, services, prices, opening hours, address
- `js/i18n.js` — every English/Arabic string
- `js/store.js` — auth + reservations (Firebase or localStorage, one API)
- `js/app.js` — shared header/footer, language toggle, auth-aware nav
