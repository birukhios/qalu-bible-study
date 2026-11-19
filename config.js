// Settings for this copy of the app.
// googleClientId: the OAuth client ID for "Sign in with Google" (Google Cloud Console › APIs & Services ›
// Credentials › OAuth client ID › Web application). It is public by design and safe to commit.
// Leave it empty to hide the Google button; the login page then only offers "Continue without signing in".
// firebase: the Firebase project that keeps each Google account's notes, highlights and Journey progress in step
// across devices (Firebase console › Project settings › Your apps › Web app: apiKey and projectId). Like the client
// ID, these are public by design; firestore.rules is what keeps each person's data private. Leave it null to keep
// everything on each device only.
window.QALU_CONFIG = {
  googleClientId: '393517702913-nr045p51jq286kvs038i8ve8h7a1krrf.apps.googleusercontent.com',
  firebase: null // for example { apiKey: 'AIza…', projectId: 'qalu-bible' }
};
