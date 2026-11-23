export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getMongoClient } = await import("@/lib/db/client");
    // Attempt initial MongoDB connection on server startup so connection status is logged immediately.
    // Errors are already logged by getMongoClient; catch here so server startup is not crashed.
    await getMongoClient().catch(() => {});
  }
}

