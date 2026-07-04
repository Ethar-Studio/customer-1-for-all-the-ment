/* ============================================================
   ALL MEN SALON — data + auth layer

   Two logins, both on Firebase email/password:
   • CUSTOMERS — real email + password (must verify email before booking)
   • ADMIN     — username + password -> <username>@staff.forallmen.app

   Two backends behind one API:
   • FIREBASE  — when real keys are in js/firebase-config.js
                 (Firestore: 'users' and 'reservations' collections)
   • DEMO      — localStorage fallback so the site works with zero setup

   Every method is async so pages don't care which backend is active.
   ============================================================ */

(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = cfg.apiKey && !String(cfg.apiKey).startsWith('PASTE_');
  const hasSdk = typeof firebase !== 'undefined' && firebase.initializeApp;
  const useFirebase = configured && hasSdk;

  /* Customers: phone → digits → synthetic email  (p<digits>@forallmen.app)
     Admins:    username    → synthetic email  (<username>@staff.forallmen.app) */
  const ADMIN_DOMAIN = '@staff.forallmen.app';
  const normPhone = (p) => String(p || '').replace(/\D/g, '');
  const normUser  = (u) => String(u || '').trim().toLowerCase();
  const phoneEmail = (p) => 'p' + normPhone(p) + '@forallmen.app';
  const adminEmail = (u) => normUser(u) + ADMIN_DOMAIN;
  const isAdminUsername = (u) => (window.ADMIN_USERNAMES || []).map(normUser).includes(normUser(u));
  const newRef = () => 'AM-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 36).toString(36).toUpperCase();

  let db = null, auth = null;
  if (useFirebase) {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
  }

  /* ---------- demo-mode helpers (localStorage) ---------- */
  const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
  const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* Reject a Firestore read if it stalls (e.g. database not created yet)
     so pages degrade gracefully instead of hanging forever. */
  const raceTimeout = (promise, ms = 8000) =>
    Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('fs-timeout')), ms))]);

  const Store = {
    mode: useFirebase ? 'firebase' : 'demo',
    currentUser: null,          // {uid, name, phone, isAdmin} | null
    _authCbs: [],
    _ready: false,
    _availability: null,        // cache: { barberId: {active, off[], windows{}} }

    onAuth(cb) {
      this._authCbs.push(cb);
      if (this._ready) cb(this.currentUser);
    },

    _fireAuth(user) {
      this.currentUser = user;
      this._ready = true;
      this._authCbs.forEach((cb) => cb(user));
    },

    init() {
      if (useFirebase) {
        auth.onAuthStateChanged(async (fbUser) => {
          if (!fbUser) return this._fireAuth(null);
          const email = fbUser.email || '';
          if (email.endsWith(ADMIN_DOMAIN)) {
            const username = email.slice(0, -ADMIN_DOMAIN.length);
            this._fireAuth({ uid: fbUser.uid, name: fbUser.displayName || username, username, isAdmin: true });
          } else {
            /* pull phone (and canonical name) from the customer's Firestore doc */
            let phone = '', name = fbUser.displayName || 'Guest';
            try {
              const doc = await raceTimeout(db.collection('users').doc(fbUser.uid).get(), 6000);
              if (doc.exists) { const d = doc.data(); phone = d.phone || ''; name = d.name || name; }
            } catch (_) {}
            this._fireAuth({ uid: fbUser.uid, name, email, phone, emailVerified: fbUser.emailVerified, isAdmin: false });
          }
        });
      } else {
        const adminU = lsGet('bb_admin_session', null);
        if (adminU) return this._fireAuth({ uid: 'admin-' + adminU, name: adminU, username: adminU, isAdmin: true });
        const email = lsGet('bb_session', null);
        if (email) {
          const u = lsGet('bb_users', {})[email];
          if (u) return this._fireAuth({ uid: 'demo-' + email, name: u.name, email, phone: u.phone || '', emailVerified: true, isAdmin: false });
        }
        this._fireAuth(null);
      }
    },

    /* ---------- auth ---------- */

    async signUp(name, email, phone, password) {
      email = String(email || '').trim();
      phone = String(phone || '').trim();   // contact only — not verified
      if (useFirebase) {
        let cred;
        try {
          cred = await auth.createUserWithEmailAndPassword(email, password);
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') throw new Error('auth.err.exists');
          if (e.code === 'auth/invalid-email') throw new Error('auth.err.email');
          if (e.code === 'auth/weak-password') throw new Error('auth.err.password');
          throw new Error('auth.err.generic');
        }
        /* profile + users-doc are nice-to-have — never fail the signup over them */
        try { await cred.user.updateProfile({ displayName: name }); } catch (_) {}
        try {
          await db.collection('users').doc(cred.user.uid).set({
            name, email, phone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_) {}
        /* send the free verification link */
        try { await cred.user.sendEmailVerification(); } catch (_) {}
        this._fireAuth({ uid: cred.user.uid, name, email, phone, emailVerified: false, isAdmin: false });
      } else {
        const users = lsGet('bb_users', {});
        if (users[email]) throw new Error('auth.err.exists');
        users[email] = { name, phone, pass: btoa(password) };
        lsSet('bb_users', users);
        lsSet('bb_session', email);
        this._fireAuth({ uid: 'demo-' + email, name, email, phone, emailVerified: true, isAdmin: false });
      }
    },

    async signIn(email, password) {
      email = String(email || '').trim();
      if (useFirebase) {
        try {
          await auth.signInWithEmailAndPassword(email, password);
        } catch (e) {
          if (e.code === 'auth/user-not-found') throw new Error('auth.err.nouser');
          if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') throw new Error('auth.err.wrong');
          if (e.code === 'auth/invalid-email') throw new Error('auth.err.email');
          throw new Error('auth.err.generic');
        }
      } else {
        const u = lsGet('bb_users', {})[email];
        if (!u) throw new Error('auth.err.nouser');
        if (u.pass !== btoa(password)) throw new Error('auth.err.wrong');
        lsSet('bb_session', email);
        this._fireAuth({ uid: 'demo-' + email, name: u.name, email, emailVerified: true, isAdmin: false });
      }
    },

    /* resend the verification email to the signed-in customer */
    async resendVerification() {
      if (useFirebase && auth.currentUser) await auth.currentUser.sendEmailVerification();
    },

    /* re-check verification status after the user clicks the email link */
    async reloadUser() {
      if (useFirebase && auth.currentUser) {
        await auth.currentUser.reload();
        const u = auth.currentUser;
        const email = u.email || '';
        if (email.endsWith(ADMIN_DOMAIN)) {
          const username = email.slice(0, -ADMIN_DOMAIN.length);
          this._fireAuth({ uid: u.uid, name: u.displayName || username, username, isAdmin: true });
          return true;
        }
        const phone = (this.currentUser && this.currentUser.phone) || '';
        this._fireAuth({ uid: u.uid, name: u.displayName || 'Guest', email, phone, emailVerified: u.emailVerified, isAdmin: false });
        return u.emailVerified;
      }
      return true;
    },

    /* Admin sign-in with username + password.
       First successful attempt for a whitelisted username creates the
       account (that password becomes the admin password); later attempts
       just sign in. Only usernames in ADMIN_USERNAMES are allowed. */
    async signInAdmin(username, password) {
      username = normUser(username);
      if (!isAdminUsername(username)) throw new Error('admin.err.notadmin');
      if (useFirebase) {
        try {
          const cred = await auth.createUserWithEmailAndPassword(adminEmail(username), password);
          await cred.user.updateProfile({ displayName: username });
          try {
            await db.collection('users').doc(cred.user.uid).set({
              username, role: 'admin',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
          } catch (_) { /* rules may block the write; auth still works */ }
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
            try {
              await auth.signInWithEmailAndPassword(adminEmail(username), password);
            } catch (_) {
              throw new Error('admin.err.wrong');
            }
          } else if (e.code === 'auth/weak-password') {
            throw new Error('auth.err.password');
          } else {
            throw new Error('auth.err.generic');
          }
        }
      } else {
        const admins = lsGet('bb_admins', {});
        if (admins[username]) {
          if (admins[username].pass !== btoa(password)) throw new Error('admin.err.wrong');
        } else {
          admins[username] = { pass: btoa(password) };
          lsSet('bb_admins', admins);
        }
        lsSet('bb_admin_session', username);
        this._fireAuth({ uid: 'admin-' + username, name: username, username, isAdmin: true });
      }
    },

    async signOut() {
      if (useFirebase) await auth.signOut();
      else { localStorage.removeItem('bb_session'); localStorage.removeItem('bb_admin_session'); this._fireAuth(null); }
    },

    /* ---------- reservations ---------- */

    async createReservation(data) {
      const ref = newRef();
      const rec = { ...data, ref, status: 'pending', createdAt: new Date().toISOString() };
      if (useFirebase) {
        await db.collection('reservations').add({
          ...rec,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const all = lsGet('bb_reservations', []);
        all.push(rec);
        lsSet('bb_reservations', all);
      }
      return ref;
    },

    async myReservations() {
      if (!this.currentUser) return [];
      if (useFirebase) {
        try {
          const snap = await raceTimeout(db.collection('reservations')
            .where('uid', '==', this.currentUser.uid).get());
          return snap.docs.map((d) => ({ _docId: d.id, ...d.data() }))
            .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        } catch (_) { return []; }
      }
      return lsGet('bb_reservations', [])
        .filter((r) => r.uid === this.currentUser.uid)
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    },

    async allReservations() {
      if (useFirebase) {
        try {
          const snap = await raceTimeout(db.collection('reservations').get());
          return snap.docs.map((d) => ({ _docId: d.id, ...d.data() }))
            .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        } catch (_) { return []; }
      }
      return lsGet('bb_reservations', [])
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    },

    /* Times already reserved for a barber on a date (excludes cancelled) */
    async takenSlots(barberId, dateIso) {
      let list;
      if (useFirebase) {
        try {
          const snap = await raceTimeout(db.collection('reservations')
            .where('barberId', '==', barberId)
            .where('date', '==', dateIso).get());
          list = snap.docs.map((d) => d.data());
        } catch (_) { return new Set(); }
      } else {
        list = lsGet('bb_reservations', [])
          .filter((r) => r.barberId === barberId && r.date === dateIso);
      }
      return new Set(list.filter((r) => r.status !== 'cancelled').map((r) => r.time));
    },

    async setStatus(res, status) {
      if (useFirebase) {
        await db.collection('reservations').doc(res._docId).update({ status });
      } else {
        const all = lsGet('bb_reservations', []);
        const i = all.findIndex((r) => r.ref === res.ref);
        if (i > -1) { all[i].status = status; lsSet('bb_reservations', all); }
      }
    },

    async remove(res) {
      if (useFirebase) {
        await db.collection('reservations').doc(res._docId).delete();
      } else {
        lsSet('bb_reservations', lsGet('bb_reservations', []).filter((r) => r.ref !== res.ref));
      }
    },

    /* ---------- barber availability ----------
       Shape per barber: { active:bool, off:[dateStr...], windows:{ dateStr:{from,to} } }
       • active=false  -> barber is paused (hidden from booking)
       • off contains a date -> barber unavailable that whole day
       • windows[date]={from,to} -> barber only bookable within that time range that day */
    async loadAvailability() {
      if (useFirebase) {
        try {
          const snap = await raceTimeout(db.collection('availability').get());
          const map = {};
          snap.docs.forEach((d) => { map[d.id] = d.data(); });
          this._availability = map;
        } catch (_) {
          this._availability = this._availability || {};   // fall back: everyone available
        }
      } else {
        this._availability = lsGet('bb_availability', {});
      }
      return this._availability;
    },

    availabilityFor(barberId) {
      const a = (this._availability || {})[barberId] || {};
      return { active: a.active !== false, off: a.off || [], windows: a.windows || {} };
    },

    async setAvailability(barberId, data) {
      const clean = { active: data.active !== false, off: data.off || [], windows: data.windows || {} };
      if (useFirebase) {
        await db.collection('availability').doc(barberId).set(clean);
      } else {
        const all = lsGet('bb_availability', {});
        all[barberId] = clean;
        lsSet('bb_availability', all);
      }
      if (!this._availability) this._availability = {};
      this._availability[barberId] = clean;
    },
  };

  window.Store = Store;
  window.normPhone = normPhone;
})();
