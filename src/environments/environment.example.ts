import type { AppEnvironment } from '../app/core/interface/environment.interface';

export const environment: AppEnvironment = {
  production: false,
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
