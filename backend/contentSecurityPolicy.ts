// Fixed origins for existing Pixel 1112592431188643's gateway and fallback avoid broad cloud wildcards.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self' https://*.clarity.ms https://c.bing.com",
  "base-uri 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Meta's official fbevents.js bootstrap loader appends this exact IWL script path.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com https://connect.facebook.net https://www.clarity.ms https://scripts.clarity.ms https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://www.google.com https://www.facebook.com/signals/iwl.js https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
  "script-src-elem 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com https://connect.facebook.net https://www.clarity.ms https://scripts.clarity.ms https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://www.google.com https://www.facebook.com/signals/iwl.js https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://connect.facebook.net https://www.facebook.com https://graph.facebook.com https://*.clarity.ms https://c.bing.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://pagead2.googlesyndication.com https://ad.doubleclick.net https://md-eecad2978f7a43f5b7838c919258e6de.ecs.us-east-2.on.aws https://bded8a3c6ae-1-1053047382554.us-central1.run.app https://mpc-prod-28-1053047382554.us-central1.run.app https://mpc-prod-21-1053047382554.us-central1.run.app https://5z-2b6b7616f94640c2840d1841e1ac24c3.ecs.us-east-1.on.aws",
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://www.facebook.com",
].join('; ');
