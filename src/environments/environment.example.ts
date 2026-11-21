// 📝 Template for the git-ignored environment files.
// `npm start` / `npm run build` / `npm test` create environment.ts and environment.development.ts
// from this file automatically when they are missing (see scripts/ensure-env.mjs).
// Then fill in the real values (ask the team lead). Only PUBLIC values belong here.
import type { AppEnvironment } from '../app/core/interface/environment.interface';

export const environment: AppEnvironment = {
  production: false,
  // '/api/v1' goes through the dev proxy (proxy.conf.json).
  // For production builds use the full URL, e.g. 'https://learningladder-fw9x.onrender.com/api/v1'.
  apiUrl: '/api/v1',
  firebase: {
    apiKey: '<firebase-web-api-key>',
    authDomain: '<project>.firebaseapp.com',
    projectId: '<project-id>',
    storageBucket: '<project>.firebasestorage.app',
    messagingSenderId: '<sender-id>',
    appId: '<app-id>',
  },
};
