import { deleteCookie, getSignedCookie, setSignedCookie } from "cookie";

const secret = process.env.COOKIE_KEY || Deno.env.get('COOKIE_KEY') || 'default-secret-key-change-in-production';
const WEEK_IN_MILLISECONDS = 604800000;

// In-memory session store (for development)
// In production, use Deno KV or Redis
const sessions = new Map(); // sessionID -> { user, expiresAt }

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionID, data] of sessions.entries()) {
    if (data.expiresAt < now) {
      sessions.delete(sessionID);
    }
  }
}, 60000); // Clean up every minute

const createSession = async (c, user) => {
  try {
    const sessionID = crypto.randomUUID();
    
    // Set cookie
    await setSignedCookie(c, "session-id", sessionID, secret, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: WEEK_IN_MILLISECONDS / 1000,
    });

    // Store session in memory
    const expiresAt = Date.now() + WEEK_IN_MILLISECONDS;
    sessions.set(sessionID, {
      user,
      expiresAt,
    });

    // Try Deno KV if available (for production)
    try {
      const kv = await Deno.openKv();
      await kv.set(["sessions", sessionID], user, {
        expireIn: WEEK_IN_MILLISECONDS,
      });
    } catch (e) {
      // Deno KV not available, use in-memory store
      console.log('[Session] Using in-memory session store (Deno KV not available)');
    }
  } catch (error) {
    console.error('[Session] Error creating session:', error);
    throw error;
  }
}

const getUserFromSession = async (c) => {
  try {
    const sessionID = await getSignedCookie(c, secret, "session-id");
    if (!sessionID) {
      return null;
    }

    // Try in-memory store first
    const sessionData = sessions.get(sessionID);
    if (sessionData) {
      if (sessionData.expiresAt < Date.now()) {
        sessions.delete(sessionID);
        return null;
      }
      // Extend session
      sessionData.expiresAt = Date.now() + WEEK_IN_MILLISECONDS;
      return sessionData.user;
    }

    // Try Deno KV if available
    try {
      const kv = await Deno.openKv();
      const user = await kv.get(["sessions", sessionID]);
      const foundUser = user?.value ?? null;
      if (!foundUser) {
        return null;
      }

      await kv.set(["sessions", sessionID], foundUser, {
        expireIn: WEEK_IN_MILLISECONDS,
      });

      return foundUser;
    } catch (e) {
      // Deno KV not available, return null
      return null;
    }
  } catch (error) {
    console.error('[Session] Error getting user from session:', error);
    return null;
  }
}

const deleteSession = async (c) => {
  try {
    const sessionID = await getSignedCookie(c, secret, "session-id");
    if (!sessionID) {
      return;
    }

    // Delete from in-memory store
    sessions.delete(sessionID);

    // Delete cookie
    deleteCookie(c, "session-id", {
      path: "/"
    });

    // Try Deno KV if available
    try {
      const kv = await Deno.openKv();
      await kv.delete(["sessions", sessionID]);
    } catch (e) {
      // Deno KV not available, ignore
    }
  } catch (error) {
    console.error('[Session] Error deleting session:', error);
  }
}

export { createSession, getUserFromSession, deleteSession }