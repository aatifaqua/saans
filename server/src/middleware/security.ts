/** The security response headers. */
import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

/**
 * One strict policy for the page and the API, every header stated rather than left to library
 * defaults: everything from this origin only, no inline script or style (the built app ships one
 * CSS file), no workers, frames or plugins, HTTPS only, and geolocation for this origin only.
 */
export const securityHeaders = (behindHttps: boolean): MiddlewareHandler =>
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      // Only behind Cloud Run's HTTPS front end; a plain-HTTP local run would break otherwise.
      ...(behindHttps ? { upgradeInsecureRequests: [] } : {}),
    },
    strictTransportSecurity: behindHttps ? 'max-age=31536000; includeSubDomains' : false,
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      geolocation: ['self'],
      camera: [],
      microphone: [],
      payment: [],
      usb: [],
      serial: [],
      hid: [],
      bluetooth: [],
      accelerometer: [],
      gyroscope: [],
      magnetometer: [],
      displayCapture: [],
      browsingTopics: [],
    },
  });
