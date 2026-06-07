declare global {
  interface CloudflareEnv {
    PM_DB: D1Database;
    UPLOADS: R2Bucket;
  }
}

export {};
