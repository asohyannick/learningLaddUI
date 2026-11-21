/**
 * Shape of `src/environments/environment*.ts`.
 * Everything here ends up in the browser bundle, so it must only hold PUBLIC values.
 */
export interface AppEnvironment {
  production: boolean;
  /** Base URL of the REST API, without a trailing slash, e.g. `/api/v1` (dev proxy) or `https://host/api/v1`. */
  apiUrl: string;
  /** Firebase WEB config (public by design, protected by Firebase Security Rules). */
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}
