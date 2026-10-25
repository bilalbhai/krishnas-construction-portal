// Plain browser script: no build step or module loader is required.
(function (KC) {
  "use strict";
  let client;
  async function connect() {
    if (globalThis.location?.protocol === "file:") return null;
    const c = window.KC_CONFIG;
    if (!c?.supabaseUrl || !c?.publishableKey) return null;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl))
      throw Error("Use your hosted Supabase project URL.");
    if (c.publishableKey.startsWith("sb_secret_"))
      throw Error("A secret key must never be used in the browser.");
    if (c.publishableKey.split(".").length === 3) {
      let payload;
      try {
        payload = JSON.parse(
          atob(
            c.publishableKey
              .split(".")[1]
              .replaceAll("-", "+")
              .replaceAll("_", "/"),
          ),
        );
      } catch {
        throw Error("Invalid Supabase publishable key.");
      }
      if (payload.role !== "anon")
        throw Error(
          "Only a public anon/publishable key may be used in the browser.",
        );
    }
    let timeout;
    let sdk;
    try {
      sdk = await Promise.race([
        import("https://esm.sh/@supabase/supabase-js@2.57.4"),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                Error(
                  "Login library could not load. Check your internet connection and try again.",
                ),
              ),
            10000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    const { createClient } = sdk;
    client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: {
        persistSession: false,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    });
    return client;
  }
  function db() {
    if (!client) throw Error("Connect Supabase before using private records.");
    return client;
  }

  // Authentication errors are surfaced; no user account is simulated locally.
  async function signIn(email, password) {
    const { data, error } = await db().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw Error(error.message);
    return data;
  }
  async function signOut() {
    const { error } = await db().auth.signOut();
    if (error) throw Error(error.message);
  }
  async function resetPassword(email, redirectTo) {
    const { error } = await db().auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw Error(error.message);
  }
  async function changePassword(password) {
    const { error } = await db().auth.updateUser({ password });
    if (error) throw Error(error.message);
  }

  KC.auth = { connect, db, signIn, signOut, resetPassword, changePassword };
})((globalThis.KC = globalThis.KC || {}));
