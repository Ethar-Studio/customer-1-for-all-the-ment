/* ============================================================
   FIREBASE CONFIG — live keys for project "cuntomer-1".

   Auth model:
   • Customers sign in with EMAIL + password, and must click a free
     Firebase verification link before they can book.
   • Admin/staff sign in with USERNAME + password
       (mapped internally to  <username>@staff.forallmen.app)

   Both use Firebase "Email/Password" sign-in under the hood, so
   make sure it is enabled in the console:
     Authentication → Sign-in method → Email/Password → Enable.
   And create the database:
     Firestore Database → Create database.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDFVzFlcgv_4t4JIPZPwDpOf2W1b7TYeZ4",
  authDomain:        "cuntomer-1.firebaseapp.com",
  projectId:         "cuntomer-1",
  storageBucket:     "cuntomer-1.firebasestorage.app",
  messagingSenderId: "421458341288",
  appId:             "1:421458341288:web:12c60ea3dc4ff8002a019d",
};

/* Usernames allowed to run the admin dashboard.
   The FIRST time you sign in on admin.html with one of these usernames,
   the password you type becomes that admin account's password.
   Add more usernames here to create more staff logins. */
window.ADMIN_USERNAMES = [
  "admin",
];
