import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("shopsmart.db");
const JWT_SECRET = process.env.JWT_SECRET || "shopsmart-super-secret-key";

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    google_id TEXT,
    name TEXT,
    avatar_url TEXT
  );

  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    date TEXT,
    total REAL,
    items_json TEXT
  );
  
  CREATE TABLE IF NOT EXISTS current_list (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    price REAL,
    checked INTEGER
  );
  
  CREATE TABLE IF NOT EXISTS list_title (
    user_id TEXT PRIMARY KEY,
    title TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Middleware to authenticate user from JWT cookie
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, email: string };
      req.user = decoded;
      next();
    } catch (err) {
      res.clearCookie("token");
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- Auth Routes ---

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      
      const insertUser = db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)");
      insertUser.run(userId, email.toLowerCase(), passwordHash, name || email.split('@')[0]);

      const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ user: { id: userId, email, name } });
    } catch (err: any) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "User already exists" });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as any;
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ status: "ok" });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = db.prepare("SELECT id, email, name, avatar_url FROM users WHERE id = ?").get(decoded.userId) as any;
      res.json({ user });
    } catch (err) {
      res.json({ user: null });
    }
  });

  // --- Google OAuth Routes ---

  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = `${process.env.APP_URL}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      
      // Get user info
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userRes.json();

      // Upsert user
      let user = db.prepare("SELECT * FROM users WHERE google_id = ? OR email = ?").get(googleUser.sub, googleUser.email) as any;
      
      if (!user) {
        const userId = crypto.randomUUID();
        db.prepare("INSERT INTO users (id, email, google_id, name, avatar_url) VALUES (?, ?, ?, ?, ?)")
          .run(userId, googleUser.email, googleUser.sub, googleUser.name, googleUser.picture);
        user = { id: userId, email: googleUser.email, name: googleUser.name };
      } else if (!user.google_id) {
        db.prepare("UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?")
          .run(googleUser.sub, googleUser.picture, user.id);
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticación exitosa. Esta ventana se cerrará automáticamente.</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Google Auth Error:", err);
      res.status(500).send("Authentication failed");
    }
  });

  // --- Shopping API Routes ---
  
  app.get("/api/list", authenticate, (req: any, res) => {
    const userId = req.user.userId;
    const items = db.prepare("SELECT * FROM current_list WHERE user_id = ?").all(userId);
    const titleRow = db.prepare("SELECT title FROM list_title WHERE user_id = ?").get(userId) as { title: string } | undefined;
    
    res.json({
      items: items.map((item: any) => ({ ...item, checked: !!item.checked })),
      title: titleRow?.title || ""
    });
  });

  app.post("/api/list", authenticate, (req: any, res) => {
    const userId = req.user.userId;
    const { items, title } = req.body;

    const deleteItems = db.prepare("DELETE FROM current_list WHERE user_id = ?");
    const insertItem = db.prepare("INSERT INTO current_list (id, user_id, name, price, checked) VALUES (?, ?, ?, ?, ?)");
    const upsertTitle = db.prepare("INSERT OR REPLACE INTO list_title (user_id, title) VALUES (?, ?)");

    const transaction = db.transaction(() => {
      deleteItems.run(userId);
      for (const item of items) {
        insertItem.run(item.id, userId, item.name, item.price, item.checked ? 1 : 0);
      }
      upsertTitle.run(userId, title);
    });

    transaction();
    res.json({ status: "ok" });
  });

  app.get("/api/history", authenticate, (req: any, res) => {
    const userId = req.user.userId;
    const trips = db.prepare("SELECT * FROM trips WHERE user_id = ? ORDER BY date DESC").all(userId);
    res.json(trips.map((trip: any) => ({
      ...trip,
      items: JSON.parse(trip.items_json)
    })));
  });

  app.post("/api/history", authenticate, (req: any, res) => {
    const userId = req.user.userId;
    const { trip } = req.body;
    if (!trip) return res.status(400).json({ error: "Trip is required" });

    const insertTrip = db.prepare("INSERT INTO trips (id, user_id, title, date, total, items_json) VALUES (?, ?, ?, ?, ?, ?)");
    insertTrip.run(trip.id, userId, trip.title, trip.date, trip.total, JSON.stringify(trip.items));
    
    const deleteItems = db.prepare("DELETE FROM current_list WHERE user_id = ?");
    const deleteTitle = db.prepare("DELETE FROM list_title WHERE user_id = ?");
    
    const transaction = db.transaction(() => {
      deleteItems.run(userId);
      deleteTitle.run(userId);
    });
    transaction();

    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
