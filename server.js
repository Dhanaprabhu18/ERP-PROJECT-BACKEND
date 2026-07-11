// require("dotenv").config();

// const express = require("express");
// const cors = require("cors");
// const { Pool } = require("pg");

// const app = express();

// app.use(cors());
// app.use(express.json());

// // Neon PostgreSQL Connection
// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   database: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

// // Test Connection
// async function connectDB() {
//   try {
//     const client = await pool.connect();

//     console.log("✅ Connected to Neon PostgreSQL");

//     const db = await client.query("SELECT current_database()");
//     console.log("Database:", db.rows[0].current_database);

//     const tables = await client.query(`
//       SELECT table_name
//       FROM information_schema.tables
//       WHERE table_schema='public'
//       ORDER BY table_name
//     `);

//     console.table(tables.rows);

//     // Check login table
//     const loginTable = await client.query(`
//       SELECT EXISTS (
//         SELECT 1
//         FROM information_schema.tables
//         WHERE table_schema='public'
//         AND table_name='login'
//       ) AS exists;
//     `);

//     console.log("Login Table Exists:", loginTable.rows[0].exists);

//     client.release();
//   } catch (err) {
//     console.error("Database Error:", err);
//   }
// }

// connectDB();

// // Home
// app.get("/", (req, res) => {
//   res.send("Backend Running");
// });

// // Login API
// app.post("/api/login", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     const result = await pool.query(
//       "SELECT username FROM login WHERE username=$1 AND password=$2",
//       [username.trim(), password.trim()]
//     );

//     if (result.rows.length === 1) {
//       return res.json({
//         success: true,
//         message: "Login Successful",
//       });
//     }

//     return res.json({
//       success: false,
//       message: "Invalid Username or Password",
//     });

//   } catch (err) {
//     console.error(err);

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// });

// // Users API
// app.get("/api/users", async (req, res) => {
//   try {
//     const result = await pool.query(
//       "SELECT username FROM login ORDER BY username"
//     );

//     res.json(result.rows);

//   } catch (err) {
//     console.error(err);

//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// });

// // Start Server
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`🚀 Server Running on Port ${PORT}`);
// });




require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

// Neon PostgreSQL Connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test Connection
async function connectDB() {
  try {
    const client = await pool.connect();

    console.log("✅ Connected to Neon PostgreSQL");

    const result = await client.query("SELECT current_database()");
    console.log("Database:", result.rows[0].current_database);

    client.release();
  } catch (err) {
    console.error("Database Error:", err.message);
  }
}

connectDB();

// Home
app.get("/", (req, res) => {
  res.send("Backend Running");
});

// Login API
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      "SELECT username FROM login WHERE username = $1 AND password = $2",
      [username, password]
    );

    if (result.rows.length > 0) {
      return res.json({
        success: true,
        message: "Login Successful",
      });
    }

    return res.json({
      success: false,
      message: "Invalid Username or Password",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// Users
app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT username FROM login ORDER BY username"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server Running on Port ${PORT}`);
});