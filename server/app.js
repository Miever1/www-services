import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";

import * as middlewares from "./middlewares.js";

import * as authControl from "./auth-control.js";
import * as taskControl from "./task-control.js";
import * as profileControl from "./profile-control.js";

const app = new Hono();

// CORS configuration to allow frontend access
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8000',
  'https://baicloud.miever.net',
  'http://baicloud.miever.net'
];

app.use("/*", cors({
  origin: (origin) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return '*';
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return origin; // Return the actual origin string
    }
    // Allow any localhost origin for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return origin; // Return the actual origin string
    }
    return null; // Block this origin
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
app.use("/*", logger());        //For logging requests to this URL

//Middlewares for keeping track of user information
//Session cookies will be handled using Deno's key-value storage
app.use("*", middlewares.addUserToContextMiddleware);
//app.use(???, middlewares.accessControlMiddleware);    //Doesn't display if user is not logged in (possibly personal account?)

/*
const sql = postgres();

app.get("/", (c) => c.json({ message: "Hello world!" }));
app.get("/todos", async (c) => {
  const todos = await sql`SELECT * FROM todos`;
  return c.json(todos);
});

app.post("/", async (c) => {
  const { query } = await c.req.json();
  const result = await sql.unsafe(query);
  return c.json(result);
});
*/
app.get("/tasks", taskControl.listAllTasks);
app.post("/tasks", taskControl.createTask);
app.get("/tasks/:id", taskControl.showTask);
app.post("/tasks/:id", taskControl.updateTask);
app.post("/tasks/:id/delete", taskControl.deleteTask);
app.post("/tasks/:id/complete", taskControl.markTaskAsComplete);
app.post("/tasks/:id/incomplete", taskControl.markTaskAsIncomplete);

/*
app.post("/users", userManager.registerUser)
app.post("/login", userManager.authenticateUser)
*/

//app.get("/auth/registration", );         //Show form for registration
app.post("/auth/registration", authControl.registerUser);        //Form should post here to register user
app.post("/auth/send-code", authControl.sendVerificationCode);  //Send verification code to email
app.post("/auth/verify-code", authControl.verifyCode);          //Verify email code
//app.get("/auth/login", ???);                //Show form for logging in
app.post("/auth/login", authControl.loginUser);               //Form should post here to log user in
app.post("/auth/logout", authControl.logoutUser);              //Form should post here to log user out

// Auth endpoints - return current user from context
app.get("/auth/session", (c) => {
  // Return current user from middleware (c.user)
  return c.json({ user: c.user || null });
});

// Profile endpoints
app.get("/profile", profileControl.getProfile);
app.put("/profile", profileControl.updateProfile);
app.patch("/profile", profileControl.updateProfile);
app.post("/profile", profileControl.updateProfile); // Support POST method for compatibility

// Auth profile endpoint (alias for compatibility)
app.post("/auth/update-profile", profileControl.updateProfile);

export default app;