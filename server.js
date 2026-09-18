

 
// =====================================================
// IMPORTS
// =====================================================

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

// =====================================================
// CREATE EXPRESS APP
// =====================================================

const app = express();

// =====================================================
// PORT
// =====================================================

const PORT = process.env.PORT || 5000;

// =====================================================
// CORS + JSON MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// =====================================================
// NEON POSTGRESQL CONNECTION
// =====================================================

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  ssl: {
    rejectUnauthorized: false,
  },

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// =====================================================
// TEST DATABASE CONNECTION
// =====================================================

async function connectDB() {
  let client;

  try {
    client = await pool.connect();

    console.log("========================================");
    console.log("✅ Database connected successfully");
    console.log("========================================");

    const result = await client.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user
    `);

    console.log("Database:", result.rows[0].database_name);
    console.log("User:", result.rows[0].database_user);

  } catch (err) {
    console.error("========================================");
    console.error("❌ Database connection failed");
    console.error("Error:", err.message);
    console.error("========================================");

  } finally {
    if (client) {
      client.release();
    }
  }
}

connectDB();

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Alan Electrical Works Backend Running",
    database: "Neon PostgreSQL",
    port: PORT,
  });
});

// =====================================================
// DATABASE HEALTH CHECK
// =====================================================

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        NOW() AS server_time
    `);

    res.status(200).json({
      success: true,
      server: "Running",
      database: "Connected",
      database_name: result.rows[0].database_name,
      database_user: result.rows[0].database_user,
      server_time: result.rows[0].server_time,
    });

  } catch (err) {
    console.error("HEALTH CHECK ERROR:", err);

    res.status(500).json({
      success: false,
      server: "Running",
      database: "Disconnected",
      error: err.message,
    });
  }
});
// =====================================================
// LOGIN API
// =====================================================
// =========================================================
// LOGIN API - POSTGRESQL
// =========================================================

app.post("/api/login", async (req, res) => {
  try {
    const { userid, password } = req.body;

    if (!userid || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and Password are required"
      });
    }

    const result = await pool.query(
      `
      SELECT username
      FROM login
      WHERE username = $1
        AND password = $2
      `,
      [userid, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid Username or Password"
      });
    }

    return res.json({
      success: true,
      message: "Login Successful",
      user: result.rows[0].username
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Database Login Error"
    });
  }
});

// =====================================================
// HSN MASTER - GET
// =====================================================

app.get("/api/hsn", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        hsncode,
        hsndesc,
        hsndetails
       FROM salestaxproductmaster
       ORDER BY hsncode`
    );

    res.json(result.rows);

  } catch (err) {
    console.error("HSN LOAD ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// HSN MASTER - GET LIST
// =====================================================

app.get("/api/hsnlist", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        hsncode,
        hsndesc
       FROM salestaxproductmaster
       ORDER BY hsndesc`
    );

    res.json(result.rows);

  } catch (err) {
    console.error("HSN LIST ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// HSN MASTER - SAVE
// =====================================================

app.post("/api/hsn", async (req, res) => {
  try {
    const {
      hsncode,
      hsndesc,
      hsndetails
    } = req.body;

    if (!hsncode || !hsndesc) {
      return res.status(400).json({
        success: false,
        message: "HSN Code and Description are required",
      });
    }

    const check = await pool.query(
      `SELECT hsncode
       FROM salestaxproductmaster
       WHERE hsncode = $1`,
      [hsncode]
    );

    if (check.rows.length > 0) {
      return res.json({
        success: false,
        message: "HSN Code Already Exists",
      });
    }

    const result = await pool.query(
      `INSERT INTO salestaxproductmaster
       (hsncode, hsndesc, hsndetails)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        hsncode,
        hsndesc,
        hsndetails || ""
      ]
    );

    res.status(201).json({
      success: true,
      message: "Saved Successfully",
      data: result.rows[0],
    });

  } catch (err) {
    console.error("HSN SAVE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// HSN MASTER - UPDATE
// =====================================================

app.put("/api/hsn/:hsncode", async (req, res) => {
  try {
    const { hsncode } = req.params;
    const {
      hsndesc,
      hsndetails
    } = req.body;

    const result = await pool.query(
      `UPDATE salestaxproductmaster
       SET
         hsndesc = $1,
         hsndetails = $2
       WHERE hsncode = $3`,
      [
        hsndesc,
        hsndetails,
        hsncode
      ]
    );

    if (result.rowCount === 0) {
      return res.json({
        success: false,
        message: "HSN Code not found",
      });
    }

    res.json({
      success: true,
      message: "Updated Successfully",
    });

  } catch (err) {
    console.error("HSN UPDATE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// HSN MASTER - DELETE
// =====================================================

app.delete("/api/hsn/:hsncode", async (req, res) => {
  try {
    const { hsncode } = req.params;

    const result = await pool.query(
      `DELETE FROM salestaxproductmaster
       WHERE hsncode = $1`,
      [hsncode]
    );

    if (result.rowCount === 0) {
      return res.json({
        success: false,
        message: "HSN Code not found",
      });
    }

    res.json({
      success: true,
      message: "Deleted Successfully",
    });

  } catch (err) {
    console.error("HSN DELETE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// TAX MASTER - GET
// =====================================================

app.get("/api/tax/:code", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM salestaxratemaster
       WHERE hsncode = $1
       ORDER BY taxdate DESC`,
      [req.params.code]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("TAX LOAD ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// TAX MASTER - SAVE
// =====================================================

app.post("/api/tax", async (req, res) => {
  try {
    const {
      hsncode,
      taxdate,
      tax,
      igst,
      cgst,
      sgst
    } = req.body;

    if (!hsncode || !taxdate) {
      return res.status(400).json({
        success: false,
        message: "HSN Code and Tax Date are required",
      });
    }

    const check = await pool.query(
      `SELECT *
       FROM salestaxratemaster
       WHERE hsncode = $1
       AND taxdate = $2`,
      [
        hsncode,
        taxdate
      ]
    );

    if (check.rows.length > 0) {
      return res.json({
        success: false,
        message: "Tax Date Already Exists",
      });
    }

    const result = await pool.query(
      `INSERT INTO salestaxratemaster
       (hsncode, taxdate, tax, igst, cgst, sgst)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        hsncode,
        taxdate,
        tax,
        igst,
        cgst,
        sgst
      ]
    );

    res.status(201).json({
      success: true,
      message: "Saved Successfully",
      data: result.rows[0],
    });

  } catch (err) {
    console.error("TAX SAVE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// TAX MASTER - UPDATE
// =====================================================

app.put("/api/tax/:hsncode/:taxdate", async (req, res) => {
  try {
    const {
      tax,
      igst,
      cgst,
      sgst
    } = req.body;

    const {
      hsncode,
      taxdate
    } = req.params;

    const result = await pool.query(
      `UPDATE salestaxratemaster
       SET
         tax = $1,
         igst = $2,
         cgst = $3,
         sgst = $4
       WHERE hsncode = $5
       AND taxdate = $6`,
      [
        tax,
        igst,
        cgst,
        sgst,
        hsncode,
        taxdate
      ]
    );

    if (result.rowCount === 0) {
      return res.json({
        success: false,
        message: "Tax record not found",
      });
    }

    res.json({
      success: true,
      message: "Updated Successfully",
    });

  } catch (err) {
    console.error("TAX UPDATE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// TAX MASTER - DELETE
// =====================================================

app.delete("/api/tax/:hsncode/:taxdate", async (req, res) => {
  try {
    const {
      hsncode,
      taxdate
    } = req.params;

    const result = await pool.query(
      `DELETE FROM salestaxratemaster
       WHERE hsncode = $1
       AND taxdate = $2`,
      [
        hsncode,
        taxdate
      ]
    );

    if (result.rowCount === 0) {
      return res.json({
        success: false,
        message: "Tax record not found",
      });
    }

    res.json({
      success: true,
      message: "Deleted Successfully",
    });

  } catch (err) {
    console.error("TAX DELETE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/// PRODUCT HEAD MASTER


// =====================================================
// PRODUCT HEAD MASTER API
// =====================================================
app.post("/api/product", async (req, res) => {

  const client = await pool.connect();

  try {

    const {
      productid,
      productname,
      uom,
      hsndesc
    } = req.body;

    // -----------------------------
    // VALIDATION
    // -----------------------------

    if (
      productid === undefined ||
      productid === null ||
      !productname ||
      !uom ||
      !hsndesc
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Product ID, Product Name, UOM and HSN Description are required"
      });

    }

    const pid = String(productid).trim();
    const pname = String(productname).trim();
    const puom = String(uom).trim();
    const phsn = String(hsndesc).trim();

    if (!pid || !pname || !puom || !phsn) {

      return res.status(400).json({
        success: false,
        message:
          "Product ID, Product Name, UOM and HSN Description cannot be empty"
      });

    }

    await client.query("BEGIN");

    // -----------------------------
    // CHECK PRODUCT DUPLICATE
    // -----------------------------

    const checkProduct = await client.query(
      `
      SELECT productid
      FROM productheadmaster
      WHERE productid = $1
      `,
      [pid]
    );

    if (checkProduct.rowCount > 0) {

      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Product ID already exists"
      });

    }

    // -----------------------------
    // SAVE PRODUCT HEAD MASTER
    // -----------------------------

    const productResult = await client.query(
      `
      INSERT INTO productheadmaster
      (
        productid,
        productname,
        productuom
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      RETURNING
        productid,
        productname,
        productuom AS uom
      `,
      [
        pid,
        pname,
        puom
      ]
    );

    // -----------------------------
    // SAVE HSN DESCRIPTION
    // -----------------------------

    await client.query(
      `
      INSERT INTO salestaxproductmaster
      (
        productid,
        hsndesc
      )
      VALUES
      (
        $1,
        $2
      )
      `,
      [
        pid,
        phsn
      ]
    );

    // -----------------------------
    // COMMIT
    // -----------------------------

    await client.query("COMMIT");

    res.status(201).json({

      success: true,

      message: "Product Saved Successfully",

      data: {
        ...productResult.rows[0],
        hsndesc: phsn
      }

    });

  } catch (err) {

    await client.query("ROLLBACK");

    console.error(
      "PRODUCT SAVE ERROR:",
      err
    );

    res.status(500).json({

      success: false,

      message: "Product save failed",

      error: err.message

    });

  } finally {

    client.release();

  }

});

// =====================================================
// PRODUCT - GET ALL / LIST
// =====================================================

app.get("/api/product", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        productid,
        productname,
        productuom AS uom
      FROM productheadmaster
      ORDER BY productid
    `);

    res.status(200).json({

      success: true,

      data: result.rows

    });

  } catch (err) {

    console.error("PRODUCT GET ERROR:", err);

    res.status(500).json({

      success: false,

      message: "Failed to load products",

      error: err.message

    });

  }

});


// =====================================================
// PRODUCT - SAVE
// =====================================================

app.post("/api/product", async (req, res) => {

  try {

    console.log("PRODUCT SAVE BODY:", req.body);

    const {
      productid,
      productname,
      uom,
      hsndesc
    } = req.body;


    // -----------------------------
    // VALIDATION
    // -----------------------------

    if (
      productid === undefined ||
      productid === null ||
      !productname ||
      !uom ||
      !hsndesc
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Product ID, Product Name and UOM are required"

      });

    }


    const pid = String(productid).trim();
    const pname = String(productname).trim();
    const puom = String(uom).trim();
    const phsn = String(hsndesc).trim();


    if (!pid || !pname || !puom || !phsn) {

      return res.status(400).json({

        success: false,

        message:
          "Product ID, Product Name, UOM and HSN Description cannot be empty"

      });

    }


    // -----------------------------
    // CHECK DUPLICATE
    // -----------------------------

    const checkProduct = await pool.query(
      `
      SELECT productid
      FROM productheadmaster
      WHERE productid = $1
      `,
      [pid]
    );


    if (checkProduct.rowCount > 0) {

      return res.status(409).json({

        success: false,

        message: "Product ID already exists"

      });

    }


    // -----------------------------
    // SAVE PRODUCT HEAD MASTER ONLY
    // -----------------------------

    const result = await pool.query(
      `
      INSERT INTO productheadmaster
      (
        productid,
        productname,
        productuom,
        hsndesc
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      RETURNING
        productid,
        productname,
        productuom AS uom,
        hsndesc
      `,
      [
        pid,
        pname,
        puom,
        phsn
      ]
    );


    console.log(
      "PRODUCT SAVED:",
      result.rows[0]
    );


    res.status(201).json({

      success: true,

      message: "Product Saved Successfully",

      data: result.rows[0]

    });


  } catch (err) {

    console.error(
      "PRODUCT SAVE ERROR:",
      err
    );

    res.status(500).json({

      success: false,

      message: "Product save failed",

      error: err.message

    });

  }

});


// =====================================================
// PRODUCT - UPDATE
// =====================================================

app.put("/api/product/:productid", async (req, res) => {

  try {

    const { productid } = req.params;

    const {
      productname,
      uom
    } = req.body;


    // -----------------------------
    // VALIDATION
    // -----------------------------

    if (!productname || !uom || !hsndesc) {

      return res.status(400).json({

        success: false,

        message:
          "Product Name, UOM and HSN Description are required"

      });

    }


    const pid = String(productid).trim();
    const pname = String(productname).trim();
    const puom = String(uom).trim();
    const phsn = String(hsndesc).trim();

    if (!pid || !pname || !puom || !phsn) {

      return res.status(400).json({

        success: false,

        message:
          "Product ID, Product Name, UOM and HSN Description cannot be empty"

      });

    }


    // -----------------------------
    // UPDATE PRODUCT HEAD MASTER ONLY
    // -----------------------------

    const result = await pool.query(
      `
      UPDATE productheadmaster
      SET
        productname = $1,
        productuom = $2,
        hsndesc = $3
      WHERE productid = $4
      RETURNING
        productid,
        productname,
        productuom AS uom,
        hsndesc
      `,
      [
        pname,
        puom,
        phsn,
        pid
      ]
    );


    // -----------------------------
    // PRODUCT NOT FOUND
    // -----------------------------

    if (result.rowCount === 0) {

      return res.status(404).json({

        success: false,

        message: "Product ID not found"

      });

    }


    console.log(
      "PRODUCT UPDATED:",
      result.rows[0]
    );


    res.status(200).json({

      success: true,

      message: "Product Updated Successfully",

      data: result.rows[0]

    });


  } catch (err) {

    console.error(
      "PRODUCT UPDATE ERROR:",
      err
    );

    res.status(500).json({

      success: false,

      message: "Product update failed",

      error: err.message

    });

  }

});


app.delete("/api/product/:productid", async (req, res) => {

  try {

    const { productid } = req.params;

    const pid = String(productid).trim();


    if (!pid) {

      return res.status(400).json({

        success: false,

        message: "Product ID is required"

      });

    }




    const result = await pool.query(
      `
      DELETE FROM productheadmaster
      WHERE productid = $1
      RETURNING
        productid,
        productname,
        productuom AS uom
      `,
      [pid]
    );


  

    if (result.rowCount === 0) {

      return res.status(404).json({

        success: false,

        message: "Product ID not found"

      });

    }


    console.log(
      "PRODUCT DELETED:",
      result.rows[0]
    );


    res.status(200).json({

      success: true,

      message: "Product Deleted Successfully",

      data: result.rows[0]

    });


  } catch (err) {

    console.error(
      "PRODUCT DELETE ERROR:",
      err
    );

    res.status(500).json({

      success: false,

      message: "Product delete failed",

      error: err.message

    });

  }

});

/// CONTRA ENTRY

// =====================================================
// GET ACCOUNTS
// =====================================================
app.get("/api/accounts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT account_id, account_name, account_type
      FROM accounts
      WHERE is_active = TRUE
      ORDER BY account_name
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("ACCOUNT LOAD ERROR:", err);
    res.status(500).json({
      error: err.message
    });
  }
});


// =====================================================
// GET NEXT CONTRA VOUCHER NUMBER
// =====================================================
app.get("/api/contra/next-voucher", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(voucher_no FROM '[0-9]+')
            AS INTEGER
          )
        ), 0
      ) + 1 AS next_no
      FROM contra
    `);

    const nextNo = result.rows[0].next_no;

    res.json({
      voucher_no: `CE${String(nextNo).padStart(4, "0")}`
    });

  } catch (err) {
    console.error("NEXT VOUCHER ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});


// =====================================================
// SAVE CONTRA ENTRY
// =====================================================
app.post("/api/contra", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      voucher_no,
      voucher_date,
      narration,
      lines
    } = req.body;

    // ---------------------------------------------
    // BASIC VALIDATION
    // ---------------------------------------------

    if (!voucher_no) {
      return res.status(400).json({
        error: "Voucher number required"
      });
    }

    if (!voucher_date) {
      return res.status(400).json({
        error: "Voucher date required"
      });
    }

    if (!lines || lines.length < 2) {
      return res.status(400).json({
        error: "At least two accounts required"
      });
    }

    // ---------------------------------------------
    // CHECK DEBIT / CREDIT
    // ---------------------------------------------

    const totalDebit = lines.reduce(
      (sum, line) => sum + Number(line.debit || 0),
      0
    );

    const totalCredit = lines.reduce(
      (sum, line) => sum + Number(line.credit || 0),
      0
    );

    if (totalDebit <= 0) {
      return res.status(400).json({
        error: "Debit amount required"
      });
    }

    if (totalDebit !== totalCredit) {
      return res.status(400).json({
        error: "Debit and Credit must be equal"
      });
    }

    // ---------------------------------------------
    // TRANSACTION START
    // ---------------------------------------------

    await client.query("BEGIN");

    // ---------------------------------------------
    // INSERT HEADER
    // ---------------------------------------------

    const headerResult = await client.query(
      `
      INSERT INTO contra
      (
        voucher_no,
        voucher_date,
        narration
      )
      VALUES ($1, $2, $3)
      RETURNING contra_id
      `,
      [
        voucher_no,
        voucher_date,
        narration || null
      ]
    );

    const contraId = headerResult.rows[0].contra_id;

    // ---------------------------------------------
    // INSERT LINES
    // ---------------------------------------------

    for (const line of lines) {

      await client.query(
        `
        INSERT INTO contra_lines
        (
          contra_id,
          account_id,
          debit,
          credit,
          line_narration
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          contraId,
          line.account_id,
          Number(line.debit || 0),
          Number(line.credit || 0),
          line.line_narration || null
        ]
      );
    }

    // ---------------------------------------------
    // COMMIT
    // ---------------------------------------------

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Contra Entry Saved Successfully",
      contra_id: contraId,
      voucher_no: voucher_no
    });

  } catch (err) {

    await client.query("ROLLBACK");

    console.error("CONTRA SAVE ERROR:", err);

    res.status(500).json({
      error: err.message
    });

  } finally {
    client.release();
  }
});


// =====================================================
// GET CONTRA ENTRIES
// =====================================================
app.get("/api/contra", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        c.contra_id,
        c.voucher_no,
        c.voucher_date,
        c.narration,

        cl.line_id,
        cl.account_id,
        a.account_name,
        cl.debit,
        cl.credit,
        cl.line_narration

      FROM contra c

      INNER JOIN contra_lines cl
        ON c.contra_id = cl.contra_id

      INNER JOIN accounts a
        ON cl.account_id = a.account_id

      ORDER BY
        c.voucher_date DESC,
        c.contra_id DESC,
        cl.line_id
    `);

    res.json(result.rows);

  } catch (err) {

    console.error("CONTRA LIST ERROR:", err);

    res.status(500).json({
      error: err.message
    });

  }

});


/// BILL ENTRY

// =========================================================
// BILL MASTER API
// =========================================================


// =========================================================
// GET ALL BILL MASTER PRODUCTS
// GET /api/billmaster
// =========================================================

// =========================================================
// BILL ENTRY APIs
// =========================================================


// =========================================================
// GET NEXT BILL NUMBER
// GET /api/bills/next-number
// =========================================================

// =========================================================
// GET NEXT BILL NUMBER
// GET /api/bills/next-number
// =========================================================

app.get("/api/bills/next-number", async (req, res) => {
    try {

        // Get the highest numeric bill number
        // Example:
        // B00001
        // B00002
        // B00003
        // => next B00004

        const result = await pool.query(`
            SELECT
                COALESCE(
                    MAX(
                        CAST(
                            REGEXP_REPLACE(
                                bill_no,
                                '[^0-9]',
                                '',
                                'g'
                            ) AS INTEGER
                        )
                    ),
                    0
                ) AS max_number
            FROM bills
            WHERE bill_type = 'SALES'
              AND bill_no ~ '[0-9]+'
        `);

        const maxNumber =
            Number(result.rows[0]?.max_number) || 0;

        const nextNumber = maxNumber + 1;

        const nextBillNo =
            `B${String(nextNumber).padStart(5, "0")}`;

        console.log(
            "LAST BILL NUMBER:",
            maxNumber
        );

        console.log(
            "NEXT BILL NUMBER:",
            nextBillNo
        );

        res.status(200).json({
            success: true,
            bill_no: nextBillNo,
            next_number: nextNumber
        });

    } catch (error) {

        console.error(
            "NEXT BILL NUMBER ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to generate bill number",
            error: error.message
        });
    }
});


// =========================================================
// SAVE BILL
// POST /api/bills
// =========================================================

app.post("/api/bills", async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            bill_no,
            bill_date,
            bill_type,
            party_id,
            party_name,
            reference_no,
            subtotal,
            discount,
            taxable_amount,
            cgst_amount,
            sgst_amount,
            igst_amount,
            tax_amount,
            grand_total,
            paid_amount,
            balance_amount,
            payment_mode,
            narration,
            items
        } = req.body;


        // =====================================================
        // VALIDATION
        // =====================================================

        if (!bill_no) {
            return res.status(400).json({
                success: false,
                message: "Bill number is required"
            });
        }

        if (!bill_date) {
            return res.status(400).json({
                success: false,
                message: "Bill date is required"
            });
        }

        if (!bill_type) {
            return res.status(400).json({
                success: false,
                message: "Bill type is required"
            });
        }

        if (!party_name || !String(party_name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Customer / Supplier name is required"
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one product is required"
            });
        }


        // =====================================================
        // START TRANSACTION
        // =====================================================

        await client.query("BEGIN");


        // =====================================================
        // CHECK DUPLICATE BILL NUMBER
        // =====================================================

        const duplicate = await client.query(
            `
            SELECT bill_id
            FROM bills
            WHERE bill_no = $1
            LIMIT 1
            `,
            [String(bill_no).trim()]
        );


        if (duplicate.rows.length > 0) {

            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "Bill number already exists"
            });
        }


        // =====================================================
        // INSERT BILL MASTER
        // =====================================================

        const billResult = await client.query(
            `
            INSERT INTO bills
            (
                bill_no,
                bill_date,
                bill_type,
                party_id,
                party_name,
                reference_no,
                subtotal,
                discount,
                taxable_amount,
                cgst_amount,
                sgst_amount,
                igst_amount,
                tax_amount,
                grand_total,
                paid_amount,
                balance_amount,
                payment_mode,
                narration
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17,
                $18
            )
            RETURNING
                bill_id,
                bill_no,
                bill_date,
                bill_type,
                party_name,
                grand_total,
                paid_amount,
                balance_amount
            `,
            [
                String(bill_no).trim(),

                bill_date,

                String(bill_type).trim(),

                party_id
                    ? Number(party_id)
                    : null,

                String(party_name).trim(),

                reference_no
                    ? String(reference_no).trim()
                    : null,

                Number(subtotal) || 0,

                Number(discount) || 0,

                Number(taxable_amount) || 0,

                Number(cgst_amount) || 0,

                Number(sgst_amount) || 0,

                Number(igst_amount) || 0,

                Number(tax_amount) || 0,

                Number(grand_total) || 0,

                Number(paid_amount) || 0,

                Number(balance_amount) || 0,

                payment_mode || "Cash",

                narration
                    ? String(narration).trim()
                    : null
            ]
        );


        const savedBill = billResult.rows[0];


        // =====================================================
        // INSERT BILL ITEMS
        // =====================================================

        for (const item of items) {

            await client.query(
                `
                INSERT INTO bill_items
                (
                    bill_id,
                    product_id,
                    product_code,
                    product_name,
                    hsn_code,
                    uom,
                    qty,
                    rate,
                    discount_percent,
                    discount_amount,
                    taxable_amount,
                    cgst_percent,
                    cgst_amount,
                    sgst_percent,
                    sgst_amount,
                    igst_percent,
                    igst_amount,
                    line_total
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18
                )
                `,
                [

                    savedBill.bill_id,

                    Number(item.product_id),

                    item.product_code || "",

                    item.product_name || "",

                    item.hsn_code || null,

                    item.uom || null,

                    Number(item.qty) || 0,

                    Number(item.rate) || 0,

                    Number(item.discount_percent) || 0,

                    Number(item.discount_amount) || 0,

                    Number(item.taxable_amount) || 0,

                    Number(item.cgst_percent) || 0,

                    Number(item.cgst_amount) || 0,

                    Number(item.sgst_percent) || 0,

                    Number(item.sgst_amount) || 0,

                    Number(item.igst_percent) || 0,

                    Number(item.igst_amount) || 0,

                    Number(item.line_total) || 0
                ]
            );
        }


        // =====================================================
        // COMMIT
        // =====================================================

        await client.query("COMMIT");


        console.log(
            "BILL SAVED SUCCESSFULLY:",
            savedBill
        );


        res.status(201).json({
            success: true,
            message: "Bill saved successfully",

            bill_id:
                savedBill.bill_id,

            bill_no:
                savedBill.bill_no,

            bill:
                savedBill
        });


    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "BILL SAVE ERROR:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message: "Bill number already exists",
                error: error.message
            });
        }


        res.status(500).json({
            success: false,
            message: "Failed to save bill",
            error: error.message
        });


    } finally {

        client.release();
    }
});

app.get("/api/billmaster", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                product_id,
                product_code,
                product_name,
                hsn_code,
                productuom,
                rate,
                cgst,
                sgst,
                igst,
                created_at,
                updated_at
            FROM BillMaster
            ORDER BY product_id DESC
        `);

        res.status(200).json({
            success: true,
            products: result.rows
        });

    } catch (error) {

        console.error(
            "BILL MASTER GET ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load Bill Master",
            error: error.message
        });
    }
});


// =========================================================
// GET NEXT PRODUCT CODE
// GET /api/billmaster/next-code
// =========================================================

app.get("/api/billmaster/next-code", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT product_code
            FROM BillMaster
            ORDER BY product_id DESC
            LIMIT 1
        `);

        let nextNumber = 1;

        if (result.rows.length > 0) {

            const lastCode =
                result.rows[0].product_code;

            const match =
                String(lastCode).match(/(\d+)$/);

            if (match) {
                nextNumber =
                    Number(match[1]) + 1;
            }
        }

        const nextCode =
            `P${String(nextNumber).padStart(3, "0")}`;

        res.status(200).json({
            success: true,
            product_code: nextCode
        });

    } catch (error) {

        console.error(
            "BILL MASTER NEXT CODE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to generate product code",
            error: error.message
        });
    }
});


// =========================================================
// ADD BILL MASTER PRODUCT
// POST /api/billmaster
// =========================================================

app.post("/api/billmaster", async (req, res) => {

    try {

        const {
            product_code,
            product_name,
            hsn_code,
            productuom,
            rate,
            cgst,
            sgst,
            igst
        } = req.body;


        // =====================================================
        // VALIDATION
        // =====================================================

        if (
            !product_code ||
            !String(product_code).trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Product code is required"
            });
        }


        if (
            !product_name ||
            !String(product_name).trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }


        // =====================================================
        // CHECK DUPLICATE PRODUCT CODE
        // =====================================================

        const duplicate = await pool.query(
            `
            SELECT product_id
            FROM BillMaster
            WHERE product_code = $1
            LIMIT 1
            `,
            [
                String(product_code).trim()
            ]
        );


        if (duplicate.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Product code already exists"
            });
        }


        // =====================================================
        // INSERT PRODUCT
        // =====================================================

        const result = await pool.query(
            `
            INSERT INTO BillMaster
            (
                product_code,
                product_name,
                hsn_code,
                productuom,
                rate,
                cgst,
                sgst,
                igst
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
            )
            RETURNING
                product_id,
                product_code,
                product_name,
                hsn_code,
                productuom,
                rate,
                cgst,
                sgst,
                igst,
                created_at,
                updated_at
            `,
            [
                String(product_code).trim(),
                String(product_name).trim(),

                hsn_code
                    ? String(hsn_code).trim()
                    : null,

                productuom
                    ? String(productuom).trim()
                    : null,

                Number(rate) || 0,
                Number(cgst) || 0,
                Number(sgst) || 0,
                Number(igst) || 0
            ]
        );


        // =====================================================
        // SUCCESS
        // =====================================================

        console.log(
            "BILL MASTER PRODUCT SAVED:",
            result.rows[0]
        );


        res.status(201).json({
            success: true,
            message: "Product saved successfully",
            product: result.rows[0]
        });


    } catch (error) {

        console.error(
            "BILL MASTER INSERT ERROR:",
            error
        );


        // PostgreSQL duplicate key
        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message: "Product code already exists",
                error: error.message
            });
        }


        res.status(500).json({
            success: false,
            message: "Failed to save product",
            error: error.message
        });
    }
});


// =========================================================
// GET SINGLE BILL MASTER PRODUCT
// GET /api/billmaster/:id
// =========================================================

app.get("/api/billmaster/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                product_id,
                product_code,
                product_name,
                hsn_code,
                productuom,
                rate,
                cgst,
                sgst,
                igst,
                created_at,
                updated_at
            FROM BillMaster
            WHERE product_id = $1
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        res.status(200).json({
            success: true,
            product: result.rows[0]
        });


    } catch (error) {

        console.error(
            "BILL MASTER GET ONE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load product",
            error: error.message
        });
    }
});


// =========================================================
// UPDATE BILL MASTER PRODUCT
// PUT /api/billmaster/:id
// =========================================================

app.put("/api/billmaster/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const {
            product_code,
            product_name,
            hsn_code,
            productuom,
            rate,
            cgst,
            sgst,
            igst
        } = req.body;


        if (
            !product_code ||
            !String(product_code).trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Product code is required"
            });
        }


        if (
            !product_name ||
            !String(product_name).trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }


        const result = await pool.query(
            `
            UPDATE BillMaster
            SET
                product_code = $1,
                product_name = $2,
                hsn_code = $3,
                productuom = $4,
                rate = $5,
                cgst = $6,
                sgst = $7,
                igst = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $9
            RETURNING
                product_id,
                product_code,
                product_name,
                hsn_code,
                productuom,
                rate,
                cgst,
                sgst,
                igst,
                created_at,
                updated_at
            `,
            [
                String(product_code).trim(),
                String(product_name).trim(),

                hsn_code
                    ? String(hsn_code).trim()
                    : null,

                productuom
                    ? String(productuom).trim()
                    : null,

                Number(rate) || 0,
                Number(cgst) || 0,
                Number(sgst) || 0,
                Number(igst) || 0,

                id
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product: result.rows[0]
        });


    } catch (error) {

        console.error(
            "BILL MASTER UPDATE ERROR:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message: "Product code already exists"
            });
        }


        res.status(500).json({
            success: false,
            message: "Failed to update product",
            error: error.message
        });
    }
});


// =========================================================
// DELETE BILL MASTER PRODUCT
// DELETE /api/billmaster/:id
// =========================================================

app.delete("/api/billmaster/:id", async (req, res) => {

    try {

        const { id } = req.params;


        const result = await pool.query(
            `
            DELETE FROM BillMaster
            WHERE product_id = $1
            RETURNING product_id, product_code, product_name
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
            product: result.rows[0]
        });


    } catch (error) {

        console.error(
            "BILL MASTER DELETE ERROR:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Failed to delete product",
            error: error.message
        });
    }
});


//// COMMERCIAL 

// ========================================
// COMMERCIAL BILL SAVE API
// ========================================

app.post("/api/commercial-bills", async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const {
      bill_no,
      bill_date,
      bill_type,
      transport_type,
      party_id,
      party_name,
      vehicle_no,
      driver_name,
      driver_mobile,
      from_place,
      to_place,
      reference_no,
      narration,
      subtotal,
      discount,
      taxable_amount,
      cgst,
      sgst,
      igst,
      grand_total,
      paid_amount,
      balance_amount,
      payment_mode,
      materials
    } = req.body;


    // ==============================
    // SAVE BILL MASTER
    // ==============================

    const billResult = await client.query(
      `
      INSERT INTO commercial_bill_master
      (
        bill_no,
        bill_date,
        bill_type,
        transport_type,
        party_id,
        party_name,
        vehicle_no,
        driver_name,
        driver_mobile,
        from_place,
        to_place,
        reference_no,
        narration,
        subtotal,
        discount,
        taxable_amount,
        cgst,
        sgst,
        igst,
        grand_total,
        paid_amount,
        balance_amount,
        payment_mode
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      )
      RETURNING bill_id
      `,
      [
        bill_no,
        bill_date,
        bill_type,
        transport_type,
        party_id,
        party_name,
        vehicle_no,
        driver_name,
        driver_mobile,
        from_place,
        to_place,
        reference_no,
        narration,
        subtotal,
        discount,
        taxable_amount,
        cgst,
        sgst,
        igst,
        grand_total,
        paid_amount,
        balance_amount,
        payment_mode
      ]
    );


    const billId = billResult.rows[0].bill_id;


    // ==============================
    // SAVE MATERIAL DETAILS
    // ==============================

    for (const item of materials) {

      await client.query(
        `
        INSERT INTO commercial_bill_material
        (
          bill_id,
          product_id,
          product_code,
          product_name,
          hsn_code,
          uom,
          quantity,
          rate,
          discount,
          taxable_amount,
          cgst_percent,
          cgst_amount,
          sgst_percent,
          sgst_amount,
          igst_percent,
          igst_amount,
          total_amount
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17
        )
        `,
        [
          billId,
          item.product_id,
          item.product_code,
          item.product_name,
          item.hsn_code,
          item.uom,
          item.quantity,
          item.rate,
          item.discount,
          item.taxable_amount,
          item.cgst_percent,
          item.cgst_amount,
          item.sgst_percent,
          item.sgst_amount,
          item.igst_percent,
          item.igst_amount,
          item.total_amount
        ]
      );
    }


    // ==============================
    // COMMIT
    // ==============================

    await client.query("COMMIT");


    res.status(201).json({
      success: true,
      message: "Commercial Bill saved successfully",
      bill_id: billId
    });


  } catch (error) {

    await client.query("ROLLBACK");

    console.error("COMMERCIAL BILL SAVE ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {

    client.release();

  }

});
app.listen(5000, () => {
  console.log("Server running on port 5000");
});





// =====================================================
// RECEIPT API - CREDIT
// =====================================================

app.post("/api/receipts", async (req, res) => {
  try {
    const {
      receipt_no,
      receipt_date,
      party_id,
      party_name,
      receipt_mode,
      amount,
      narration,
      reference_no
    } = req.body;

    if (!receipt_no) {
      return res.status(400).json({
        success: false,
        message: "Receipt No is required"
      });
    }

    if (!receipt_date) {
      return res.status(400).json({
        success: false,
        message: "Receipt Date is required"
      });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter valid amount"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO receipt_master
      (
        receipt_no,
        receipt_date,
        party_id,
        party_name,
        receipt_mode,
        amount,
        debit_credit,
        narration,
        reference_no
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      RETURNING receipt_id
      `,
      [
        receipt_no,
        receipt_date,
        party_id === "" ? null : Number(party_id),
        party_name || null,
        receipt_mode || "CASH",
        Number(amount),
        "CREDIT",
        narration || null,
        reference_no || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Receipt saved successfully",
      receipt_id: result.rows[0].receipt_id
    });

  } catch (error) {

    console.error("RECEIPT SAVE ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =====================================================
// GET PAYMENTS
// =====================================================

app.get("/api/payments", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT *
      FROM payment_master
      ORDER BY payment_id DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {

    console.error("PAYMENT LIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =====================================================
// GET RECEIPTS
// =====================================================

app.get("/api/receipts", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT *
      FROM receipt_master
      ORDER BY receipt_id DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {

    console.error("RECEIPT LIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


app.post("/api/payments", async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            payment_no,
            payment_date,
            party_id,
            party_name,
            reference_no,
            amount,
            payment_mode,
            narration
        } = req.body;

        console.log("PAYMENT REQUEST:", req.body);

        const result = await client.query(
            `
            INSERT INTO payment_master
            (
                payment_no,
                payment_date,
                party_id,
                party_name,
                reference_no,
                amount,
                payment_mode,
                narration
            )
            VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
            `,
            [
                payment_no,
                payment_date,
                party_id || null,
                party_name,
                reference_no || null,
                amount || 0,
                payment_mode || null,
                narration || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Payment saved successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("PAYMENT SAVE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        client.release();
    }
});

app.post("/api/receipts", async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            receipt_no,
            receipt_date,
            party_id,
            party_name,
            reference_no,
            amount,
            receipt_mode,
            narration
        } = req.body;

        console.log("RECEIPT REQUEST:", req.body);

        const result = await client.query(
            `
            INSERT INTO receipt_master
            (
                receipt_no,
                receipt_date,
                party_id,
                party_name,
                reference_no,
                amount,
                receipt_mode,
                narration
            )
            VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
            `,
            [
                receipt_no,
                receipt_date,
                party_id || null,
                party_name,
                reference_no || null,
                amount || 0,
                receipt_mode || null,
                narration || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Receipt saved successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("RECEIPT SAVE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        client.release();
    }
});

app.post("/api/payments", async (req, res) => {
    try {
        console.log("PAYMENT REQUEST:", req.body);

        const {
            payment_no,
            payment_date,
            party_id,
            party_name,
            payment_mode,
            amount,
            debit_credit,
            reference_no,
            narration
        } = req.body;

        const result = await pool.query(
            `
            INSERT INTO payment_master
            (
                payment_no,
                payment_date,
                party_id,
                party_name,
                payment_mode,
                amount,
                debit_credit,
                reference_no,
                narration
            )
            VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
                payment_no,
                payment_date,
                party_id || null,
                party_name,
                payment_mode || "CASH",
                amount || 0,
                debit_credit || "DEBIT",
                reference_no || null,
                narration || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Payment saved successfully",
            payment_id: result.rows[0].payment_id,
            data: result.rows[0]
        });

    } catch (error) {
        console.error("PAYMENT SAVE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post("/api/receipts", async (req, res) => {
    try {
        console.log("RECEIPT REQUEST:", req.body);

        const {
            receipt_no,
            receipt_date,
            party_id,
            party_name,
            receipt_mode,
            amount,
            debit_credit,
            reference_no,
            narration
        } = req.body;

        const result = await pool.query(
            `
            INSERT INTO receipt_master
            (
                receipt_no,
                receipt_date,
                party_id,
                party_name,
                receipt_mode,
                amount,
                debit_credit,
                reference_no,
                narration
            )
            VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
                receipt_no,
                receipt_date,
                party_id || null,
                party_name,
                receipt_mode || "CASH",
                amount || 0,
                debit_credit || "CREDIT",
                reference_no || null,
                narration || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Receipt saved successfully",
            receipt_id: result.rows[0].receipt_id,
            data: result.rows[0]
        });

    } catch (error) {
        console.error("RECEIPT SAVE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post("/api/receipts", async (req, res) => {
    try {
        console.log("RECEIPT REQUEST:", req.body);

        const {
            receipt_no,
            receipt_date,
            party_id,
            party_name,
            receipt_mode,
            amount,
            debit_credit,
            reference_no,
            narration
        } = req.body;

        const result = await pool.query(
            `
            INSERT INTO receipt_master
            (
                receipt_no,
                receipt_date,
                party_id,
                party_name,
                receipt_mode,
                amount,
                debit_credit,
                reference_no,
                narration
            )
            VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
                receipt_no,
                receipt_date,
                party_id || null,
                party_name,
                receipt_mode || "CASH",
                amount || 0,
                debit_credit || "CREDIT",
                reference_no || null,
                narration || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Receipt saved successfully",
            receipt_id: result.rows[0].receipt_id,
            data: result.rows[0]
        });

    } catch (error) {
        console.error("RECEIPT SAVE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
app.get("/api/receipts", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                receipt_id,
                receipt_no,
                receipt_date,
                party_id,
                party_name,
                receipt_mode,
                amount,
                debit_credit,
                reference_no,
                narration,
                created_at
            FROM receipt_master
            ORDER BY receipt_id DESC
        `);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("RECEIPT LIST ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


//// PRODUCATION ENTRY API

// ============================================================
// PRODUCTION API
// ============================================================


// ============================================================
// GET NEXT PRODUCTION NUMBER
// GET /api/production/next-number
// ============================================================

app.get("/api/production/next-number", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT production_no
            FROM production
            ORDER BY id DESC
            LIMIT 1
        `);

        let nextNumber = 1;

        if (result.rows.length > 0) {
            const lastNo = result.rows[0].production_no;

            const match = String(lastNo).match(/(\d+)$/);

            if (match) {
                nextNumber = Number(match[1]) + 1;
            }
        }

        const productionNo =
            `PROD${String(nextNumber).padStart(4, "0")}`;

        res.status(200).json({
            success: true,
            production_no: productionNo
        });

    } catch (error) {
        console.error(
            "NEXT PRODUCTION NUMBER ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to generate production number",
            error: error.message
        });
    }
});


// ============================================================
// GET ALL PRODUCTION
// GET /api/production
// ============================================================

app.get("/api/production", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                production_no,
                production_date,
                product_name,
                quantity,
                unit,
                total_material_cost,
                narration,
                created_at,
                updated_at
            FROM production
            ORDER BY id DESC
        `);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error(
            "PRODUCTION LIST ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load production records",
            error: error.message
        });
    }
});


// ============================================================
// GET SINGLE PRODUCTION
// GET /api/production/:id
// ============================================================

app.get("/api/production/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const productionResult = await pool.query(
            `
            SELECT
                id,
                production_no,
                production_date,
                product_name,
                quantity,
                unit,
                total_material_cost,
                narration,
                created_at,
                updated_at
            FROM production
            WHERE id = $1
            `,
            [id]
        );

        if (productionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Production record not found"
            });
        }

        const materialResult = await pool.query(
            `
            SELECT
                id,
                production_id,
                raw_material_id,
                raw_material_name,
                quantity_consumed,
                unit,
                rate,
                amount,
                created_at
            FROM production_materials
            WHERE production_id = $1
            ORDER BY id ASC
            `,
            [id]
        );

        res.status(200).json({
            success: true,
            production: productionResult.rows[0],
            materials: materialResult.rows
        });

    } catch (error) {
        console.error(
            "PRODUCTION GET ONE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load production",
            error: error.message
        });
    }
});


// ============================================================
// CREATE PRODUCTION
// POST /api/production
// ============================================================

app.post("/api/production", async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            production_no,
            production_date,
            product_name,
            quantity,
            unit,
            narration,
            materials
        } = req.body;


        // ====================================================
        // VALIDATION
        // ====================================================

        if (!production_date) {
            return res.status(400).json({
                success: false,
                message: "Production date is required"
            });
        }

        if (!product_name || !String(product_name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }

        if (!quantity || Number(quantity) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Production quantity must be greater than zero"
            });
        }

        if (!Array.isArray(materials) || materials.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one raw material is required"
            });
        }


        // ====================================================
        // PRODUCTION NUMBER
        // ====================================================

        let finalProductionNo = production_no;

        if (!finalProductionNo) {

            const numberResult = await pool.query(`
                SELECT production_no
                FROM production
                ORDER BY id DESC
                LIMIT 1
            `);

            let nextNumber = 1;

            if (numberResult.rows.length > 0) {

                const lastNo =
                    numberResult.rows[0].production_no;

                const match =
                    String(lastNo).match(/(\d+)$/);

                if (match) {
                    nextNumber =
                        Number(match[1]) + 1;
                }
            }

            finalProductionNo =
                `PROD${String(nextNumber).padStart(4, "0")}`;
        }


        // ====================================================
        // CALCULATE MATERIAL TOTAL
        // ====================================================

        let totalMaterialCost = 0;

        const cleanMaterials = materials.map((material) => {

            const materialName =
                String(
                    material.raw_material_name || ""
                ).trim();

            const materialQty =
                Number(
                    material.quantity_consumed
                ) || 0;

            const materialRate =
                Number(
                    material.rate
                ) || 0;

            const materialAmount =
                materialQty * materialRate;

            totalMaterialCost += materialAmount;

            return {
                raw_material_id:
                    material.raw_material_id
                        ? Number(material.raw_material_id)
                        : null,

                raw_material_name:
                    materialName,

                quantity_consumed:
                    materialQty,

                unit:
                    material.unit || "Kg",

                rate:
                    materialRate,

                amount:
                    materialAmount
            };
        });


        // ====================================================
        // BEGIN TRANSACTION
        // ====================================================

        await client.query("BEGIN");


        // ====================================================
        // INSERT PRODUCTION
        // ====================================================

        const productionResult = await client.query(
            `
            INSERT INTO production
            (
                production_no,
                production_date,
                product_name,
                quantity,
                unit,
                total_material_cost,
                narration
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
            )
            RETURNING
                id,
                production_no,
                production_date,
                product_name,
                quantity,
                unit,
                total_material_cost,
                narration,
                created_at
            `,
            [
                finalProductionNo,
                production_date,
                String(product_name).trim(),
                Number(quantity),
                unit || "Nos",
                Number(totalMaterialCost.toFixed(2)),
                narration
                    ? String(narration).trim()
                    : null
            ]
        );


        const production =
            productionResult.rows[0];


        // ====================================================
        // INSERT MATERIALS
        // ====================================================

        for (const material of cleanMaterials) {

            if (
                !material.raw_material_name ||
                material.quantity_consumed <= 0
            ) {
                continue;
            }

            await client.query(
                `
                INSERT INTO production_materials
                (
                    production_id,
                    raw_material_id,
                    raw_material_name,
                    quantity_consumed,
                    unit,
                    rate,
                    amount
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                `,
                [
                    production.id,
                    material.raw_material_id,
                    material.raw_material_name,
                    material.quantity_consumed,
                    material.unit,
                    material.rate,
                    Number(
                        material.amount.toFixed(2)
                    )
                ]
            );
        }


        // ====================================================
        // COMMIT
        // ====================================================

        await client.query("COMMIT");


        console.log(
            "PRODUCTION SAVED:",
            production
        );


        res.status(201).json({
            success: true,
            message: "Production saved successfully",
            production: production
        });


    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "PRODUCTION INSERT ERROR:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message: "Production number already exists",
                error: error.message
            });
        }


        res.status(500).json({
            success: false,
            message: "Failed to save production",
            error: error.message
        });

    } finally {

        client.release();
    }
});


// ============================================================
// DELETE PRODUCTION
// DELETE /api/production/:id
// ============================================================

app.delete("/api/production/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM production
            WHERE id = $1
            RETURNING
                id,
                production_no,
                product_name
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Production record not found"
            });
        }


        res.status(200).json({
            success: true,
            message: "Production deleted successfully",
            production: result.rows[0]
        });


    } catch (error) {

        console.error(
            "PRODUCTION DELETE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to delete production",
            error: error.message
        });
    }
});


/* =========================================================
   REPORT / BILL API
   ========================================================= */


/* =========================================================
   CREATE NEW SALES / PURCHASE BILL
   =========================================================

   POST:
   /api/bills

   bill_type:
   SALES
   PURCHASE
   ========================================================= */

app.post("/api/bills", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      bill_type,
      bill_date,
      party_name,
      reference_no,
      payment_mode,

      subtotal,
      discount,
      taxable_amount,

      cgst_amount,
      sgst_amount,
      igst_amount,

      tax_amount,
      grand_total,

      paid_amount,
      balance_amount,

      narration,

      items,
    } = req.body;

  
    /* ---------------------------------------------
       VALIDATE BILL TYPE
       --------------------------------------------- */

    const billType = String(
      bill_type || ""
    ).toUpperCase();

    if (
      billType !== "SALES" &&
      billType !== "PURCHASE"
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        error:
          "bill_type must be SALES or PURCHASE",
      });
    }


    /* ---------------------------------------------
       GENERATE BILL NUMBER
       --------------------------------------------- */

    const billNo = await generateBillNo(
      client,
      billType
    );


    /* ---------------------------------------------
       INSERT BILL
       --------------------------------------------- */

    const billResult = await client.query(
      `
      INSERT INTO bills (
        bill_no,
        bill_type,
        bill_date,
        party_name,
        reference_no,
        payment_mode,

        subtotal,
        discount,
        taxable_amount,

        cgst_amount,
        sgst_amount,
        igst_amount,

        tax_amount,
        grand_total,

        paid_amount,
        balance_amount,

        narration
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,

        $7,
        $8,
        $9,

        $10,
        $11,
        $12,

        $13,
        $14,

        $15,
        $16,

        $17
      )

      RETURNING *
      `,
      [
        billNo,
        billType,

        bill_date || null,
        party_name || null,
        reference_no || null,
        payment_mode || null,

        Number(subtotal || 0),
        Number(discount || 0),
        Number(taxable_amount || 0),

        Number(cgst_amount || 0),
        Number(sgst_amount || 0),
        Number(igst_amount || 0),

        Number(tax_amount || 0),
        Number(grand_total || 0),

        Number(paid_amount || 0),
        Number(balance_amount || 0),

        narration || null,
      ]
    );


    const savedBill =
      billResult.rows[0];


    /* ---------------------------------------------
       INSERT BILL ITEMS
       --------------------------------------------- */

    if (Array.isArray(items)) {

      for (const item of items) {

        await client.query(
          `
          INSERT INTO bill_items (
            bill_id,

            product_id,
            product_code,
            product_name,

            hsn_code,
            uom,

            qty,
            rate,

            discount_amount,
            taxable_amount,

            cgst_amount,
            sgst_amount,
            igst_amount,

            line_total
          )

          VALUES (
            $1,

            $2,
            $3,
            $4,

            $5,
            $6,

            $7,
            $8,

            $9,
            $10,

            $11,
            $12,
            $13,

            $14
          )
          `,
          [
            savedBill.bill_id,

            item.product_id ||
              item.productId ||
              null,

            item.product_code ||
              item.productCode ||
              null,

            item.product_name ||
              item.productName ||
              null,

            item.hsn_code ||
              item.hsnCode ||
              null,

            item.uom || null,

            Number(
              item.qty ||
              item.quantity ||
              0
            ),

            Number(
              item.rate || 0
            ),

            Number(
              item.discount_amount ||
              item.discountAmount ||
              0
            ),

            Number(
              item.taxable_amount ||
              item.taxableAmount ||
              0
            ),

            Number(
              item.cgst_amount ||
              item.cgstAmount ||
              0
            ),

            Number(
              item.sgst_amount ||
              item.sgstAmount ||
              0
            ),

            Number(
              item.igst_amount ||
              item.igstAmount ||
              0
            ),

            Number(
              item.line_total ||
              item.lineTotal ||
              0
            ),
          ]
        );
      }
    }


    /* ---------------------------------------------
       COMMIT
       --------------------------------------------- */

    await client.query("COMMIT");


    /* ---------------------------------------------
       RESPONSE
       --------------------------------------------- */

    return res.status(201).json({
      success: true,

      message:
        billType === "SALES"
          ? "Sales invoice saved successfully"
          : "Purchase invoice saved successfully",

      bill: savedBill,

      bill_no: billNo,
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "SAVE BILL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error.message ||
        "Failed to save bill",
    });

  } finally {

    client.release();
  }
});



/* =========================================================
   GET ALL SALES / PURCHASE BILLS
   =========================================================

   SALES:
   GET /api/bills?bill_type=SALES

   PURCHASE:
   GET /api/bills?bill_type=PURCHASE

   SINGLE NUMBER:
   GET /api/bills?bill_no=B0001
   ========================================================= */

app.get("/api/bills", async (req, res) => {

  try {

    const {
      bill_type,
      bill_no,
    } = req.query;


    /* ---------------------------------------------
       BASE QUERY
       --------------------------------------------- */

    let query = `
      SELECT
        bill_id,
        bill_no,
        bill_type,
        bill_date,
        party_name,
        reference_no,
        payment_mode,

        subtotal,
        discount,
        taxable_amount,

        cgst_amount,
        sgst_amount,
        igst_amount,

        tax_amount,
        grand_total,

        paid_amount,
        balance_amount,

        narration,

        created_at

      FROM bills

      WHERE 1 = 1
    `;


    const values = [];


    /* ---------------------------------------------
       FILTER BILL TYPE
       --------------------------------------------- */

    if (bill_type) {

      values.push(
        String(
          bill_type
        ).toUpperCase()
      );

      query += `
        AND bill_type = $${values.length}
      `;
    }


    /* ---------------------------------------------
       FILTER BILL NUMBER
       --------------------------------------------- */

    if (bill_no) {

      values.push(
        String(bill_no)
      );

      query += `
        AND bill_no = $${values.length}
      `;
    }


    /* ---------------------------------------------
       ORDER
       --------------------------------------------- */

    query += `
      ORDER BY bill_id DESC
    `;


    /* ---------------------------------------------
       EXECUTE
       --------------------------------------------- */

    const result =
      await pool.query(
        query,
        values
      );


    /* ---------------------------------------------
       RESPONSE
       --------------------------------------------- */

    return res.json({
      success: true,

      bills: result.rows,
    });

  } catch (error) {

    console.error(
      "GET BILLS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error.message ||
        "Failed to get bills",
    });
  }
});



/* =========================================================
   GET ONE BILL + ITEMS
   =========================================================

   GET:
   /api/bills/B0001

   GET:
   /api/bills/B0004

   IMPORTANT:
   There is NO item_id here.
   ========================================================= */

app.get(
  "/api/bills/:billNo",
  async (req, res) => {

    try {

      const billNo =
        String(
          req.params.billNo
        ).trim();


      /* ---------------------------------------------
         GET BILL
         --------------------------------------------- */

      const billResult =
        await pool.query(
          `
          SELECT *
          FROM bills
          WHERE bill_no = $1
          LIMIT 1
          `,
          [billNo]
        );


      /* ---------------------------------------------
         BILL NOT FOUND
         --------------------------------------------- */

      if (
        billResult.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,

          error:
            "Bill not found",
        });
      }


      const bill =
        billResult.rows[0];


      /* ---------------------------------------------
         GET BILL ITEMS
         
         IMPORTANT:
         item_id REMOVED.

         We use bill_id to find the items.
         --------------------------------------------- */

      const itemsResult =
        await pool.query(
          `
          SELECT
            bill_id,

            product_id,
            product_code,
            product_name,

            hsn_code,
            uom,

            qty,
            rate,

            discount_amount,
            taxable_amount,

            cgst_amount,
            sgst_amount,
            igst_amount,

            line_total

          FROM bill_items

          WHERE bill_id = $1
          `,
          [bill.bill_id]
        );


      /* ---------------------------------------------
         RESPONSE
         --------------------------------------------- */

      return res.json({

        success: true,

        bill: {
          ...bill,

          items:
            itemsResult.rows,
        },

      });

    } catch (error) {

      console.error(
        "GET SINGLE BILL ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Failed to get bill",

      });
    }
  }
);



/* =========================================================
   GET SALES ONLY
   =========================================================

   GET:
   /api/sales
   ========================================================= */

app.get(
  "/api/sales",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT *
          FROM bills
          WHERE bill_type = 'SALES'
          ORDER BY bill_id DESC
          `
        );


      return res.json({

        success: true,

        bills:
          result.rows,

      });

    } catch (error) {

      console.error(
        "GET SALES ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Failed to get sales bills",

      });
    }
  }
);



/* =========================================================
   GET PURCHASE ONLY
   =========================================================

   GET:
   /api/purchases
   ========================================================= */

app.get(
  "/api/purchases",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT *
          FROM bills
          WHERE bill_type = 'PURCHASE'
          ORDER BY bill_id DESC
          `
        );


      return res.json({

        success: true,

        bills:
          result.rows,

      });

    } catch (error) {

      console.error(
        "GET PURCHASE ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Failed to get purchase bills",

      });
    }
  }
);



/* =========================================================
   DELETE BILL
   =========================================================

   DELETE:
   /api/bills/B0001

   IMPORTANT:
   First deletes bill_items,
   then deletes the bill.

   This avoids foreign-key errors if bill_items.bill_id
   references bills.bill_id.
   ========================================================= */

app.delete(
  "/api/bills/:billNo",
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      await client.query(
        "BEGIN"
      );


      const billNo =
        String(
          req.params.billNo
        ).trim();


      /* ---------------------------------------------
         FIND BILL
         --------------------------------------------- */

      const billResult =
        await client.query(
          `
          SELECT *
          FROM bills
          WHERE bill_no = $1
          LIMIT 1
          `,
          [billNo]
        );


      if (
        billResult.rows.length === 0
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({

          success: false,

          error:
            "Bill not found",

        });
      }


      const bill =
        billResult.rows[0];


      /* ---------------------------------------------
         DELETE ITEMS
         --------------------------------------------- */

      await client.query(
        `
        DELETE FROM bill_items
        WHERE bill_id = $1
        `,
        [bill.bill_id]
      );


      /* ---------------------------------------------
         DELETE BILL
         --------------------------------------------- */

      const deleteResult =
        await client.query(
          `
          DELETE FROM bills
          WHERE bill_id = $1
          RETURNING *
          `,
          [bill.bill_id]
        );


      /* ---------------------------------------------
         COMMIT
         --------------------------------------------- */

      await client.query(
        "COMMIT"
      );


      return res.json({

        success: true,

        message:
          "Bill deleted successfully",

        bill:
          deleteResult.rows[0],

      });

    } catch (error) {

      await client.query(
        "ROLLBACK"
      );

      console.error(
        "DELETE BILL ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Failed to delete bill",

      });

    } finally {

      client.release();
    }
  }
);


// ============================================================
// COMMERCIAL BILL APIs
// ============================================================

// ------------------------------------------------------------
// GET NEXT COMMERCIAL BILL NUMBER
// GET /api/commercial-bills/next-number
// ------------------------------------------------------------
app.get("/api/commercial-bills/next-number", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(
        MAX(
          CAST(
            REGEXP_REPLACE(
              bill_no,
              '[^0-9]',
              '',
              'g'
            ) AS INTEGER
          )
        ),
        0
      ) AS max_number
      FROM commercial_bill_master
      WHERE bill_no ~ '[0-9]+'
    `);

    const maxNumber = Number(result.rows[0]?.max_number) || 0;
    const nextNumber = maxNumber + 1;

    const billNo =
      `CB${String(nextNumber).padStart(5, "0")}`;

    res.status(200).json({
      success: true,
      bill_no: billNo,
      next_number: nextNumber
    });

  } catch (error) {
    console.error(
      "COMMERCIAL NEXT BILL NUMBER ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to generate commercial bill number",
      error: error.message
    });
  }
});


// ------------------------------------------------------------
// SAVE COMMERCIAL BILL
// POST /api/commercial-bills
// ------------------------------------------------------------
app.post("/api/commercial-bills", async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const {
      bill_no,
      bill_date,
      bill_type,
      transport_type,

      party_id,
      party_name,

      vehicle_no,
      driver_name,
      driver_mobile,

      from_place,
      to_place,

      reference_no,
      narration,

      subtotal,
      discount,
      taxable_amount,

      cgst,
      sgst,
      igst,

      grand_total,
      paid_amount,
      balance_amount,

      payment_mode,

      materials
    } = req.body;


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!bill_no || !String(bill_no).trim()) {
      return res.status(400).json({
        success: false,
        message: "Bill number is required"
      });
    }

    if (!bill_date) {
      return res.status(400).json({
        success: false,
        message: "Bill date is required"
      });
    }

    if (!bill_type) {
      return res.status(400).json({
        success: false,
        message: "Bill type is required"
      });
    }

    if (!party_name || !String(party_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Party name is required"
      });
    }

    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one material is required"
      });
    }


    // ========================================================
    // CHECK DUPLICATE BILL NUMBER
    // ========================================================

    const duplicate = await client.query(
      `
      SELECT bill_id
      FROM commercial_bill_master
      WHERE bill_no = $1
      LIMIT 1
      `,
      [String(bill_no).trim()]
    );

    if (duplicate.rows.length > 0) {

      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Commercial Bill number already exists"
      });
    }


    // ========================================================
    // INSERT BILL MASTER
    // ========================================================

    const billResult = await client.query(
      `
      INSERT INTO commercial_bill_master
      (
        bill_no,
        bill_date,
        bill_type,
        transport_type,

        party_id,
        party_name,

        vehicle_no,
        driver_name,
        driver_mobile,

        from_place,
        to_place,

        reference_no,
        narration,

        subtotal,
        discount,
        taxable_amount,

        cgst,
        sgst,
        igst,

        grand_total,
        paid_amount,
        balance_amount,

        payment_mode
      )
      VALUES
      (
        $1,$2,$3,$4,
        $5,$6,
        $7,$8,$9,
        $10,$11,
        $12,$13,
        $14,$15,$16,
        $17,$18,$19,
        $20,$21,$22,
        $23
      )
      RETURNING *
      `,
      [
        String(bill_no).trim(),
        bill_date,
        String(bill_type).trim(),
        transport_type || "ROAD",

        party_id === "" || party_id == null
          ? null
          : Number(party_id),

        String(party_name).trim(),

        vehicle_no || null,
        driver_name || null,
        driver_mobile || null,

        from_place || null,
        to_place || null,

        reference_no || null,
        narration || null,

        Number(subtotal) || 0,
        Number(discount) || 0,
        Number(taxable_amount) || 0,

        Number(cgst) || 0,
        Number(sgst) || 0,
        Number(igst) || 0,

        Number(grand_total) || 0,
        Number(paid_amount) || 0,
        Number(balance_amount) || 0,

        payment_mode || "CASH"
      ]
    );


    const bill = billResult.rows[0];

    const billId = bill.bill_id;


    // ========================================================
    // INSERT MATERIALS
    // ========================================================

    for (const item of materials) {

      await client.query(
        `
        INSERT INTO commercial_bill_material
        (
          bill_id,

          product_id,
          product_code,
          product_name,
          hsn_code,
          uom,

          quantity,
          rate,

          discount,
          taxable_amount,

          cgst_percent,
          cgst_amount,

          sgst_percent,
          sgst_amount,

          igst_percent,
          igst_amount,

          total_amount
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17
        )
        `,
        [
          billId,

          item.product_id
            ? Number(item.product_id)
            : null,

          item.product_code || null,
          item.product_name || null,
          item.hsn_code || null,
          item.uom || null,

          Number(item.quantity) || 0,
          Number(item.rate) || 0,

          Number(item.discount) || 0,
          Number(item.taxable_amount) || 0,

          Number(item.cgst_percent) || 0,
          Number(item.cgst_amount) || 0,

          Number(item.sgst_percent) || 0,
          Number(item.sgst_amount) || 0,

          Number(item.igst_percent) || 0,
          Number(item.igst_amount) || 0,

          Number(item.total_amount) || 0
        ]
      );
    }


    // ========================================================
    // COMMIT
    // ========================================================

    await client.query("COMMIT");


    console.log(
      "COMMERCIAL BILL SAVED:",
      bill
    );


    res.status(201).json({
      success: true,
      message: "Commercial Bill saved successfully",

      bill_id: bill.bill_id,
      bill_no: bill.bill_no,

      bill: bill
    });


  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "COMMERCIAL BILL SAVE ERROR:",
      error
    );


    if (error.code === "23505") {

      return res.status(409).json({
        success: false,
        message: "Commercial Bill number already exists",
        error: error.message
      });
    }


    res.status(500).json({
      success: false,
      message: "Failed to save Commercial Bill",
      error: error.message
    });


  } finally {

    client.release();

  }
});


// ============================================================
// GET ALL COMMERCIAL BILL RECORDS
// GET /api/commercial-bills
// ============================================================

app.get("/api/commercial-bills", async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT
        bill_id,

        bill_no,
        bill_date,
        bill_type,
        transport_type,

        party_id,
        party_name,

        vehicle_no,
        driver_name,
        driver_mobile,

        from_place,
        to_place,

        reference_no,
        narration,

        subtotal,
        discount,
        taxable_amount,

        cgst,
        sgst,
        igst,

        grand_total,

        paid_amount,
        balance_amount,

        payment_mode,

        created_at

      FROM commercial_bill_master

      ORDER BY bill_id DESC
      `
    );


    res.status(200).json({
      success: true,
      bills: result.rows
    });


  } catch (error) {

    console.error(
      "GET COMMERCIAL BILLS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load commercial bill records",
      error: error.message
    });

  }

});


// ============================================================
// GET SINGLE COMMERCIAL BILL
// GET /api/commercial-bills/:bill_id
// ============================================================

app.get(
  "/api/commercial-bills/:bill_id",
  async (req, res) => {

    try {

      const { bill_id } = req.params;


      // ======================================================
      // GET BILL MASTER
      // ======================================================

      const billResult = await pool.query(
        `
        SELECT
          *
        FROM commercial_bill_master
        WHERE bill_id = $1
        LIMIT 1
        `,
        [bill_id]
      );


      if (billResult.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "Commercial Bill not found"
        });

      }


      // ======================================================
      // GET MATERIALS
      // ======================================================

      const materialResult = await pool.query(
        `
        SELECT
          *
        FROM commercial_bill_material
        WHERE bill_id = $1
        ORDER BY material_id ASC
        `,
        [bill_id]
      );


      const bill = billResult.rows[0];

      bill.materials = materialResult.rows;


      res.status(200).json({
        success: true,
        bill: bill
      });


    } catch (error) {

      console.error(
        "GET COMMERCIAL BILL DETAILS ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to load commercial bill details",
        error: error.message
      });

    }

  }
);


// ============================================================
// DELETE COMMERCIAL BILL
// DELETE /api/commercial-bills/:bill_id
// ============================================================

app.delete(
  "/api/commercial-bills/:bill_id",
  async (req, res) => {

    const client = await pool.connect();

    try {

      await client.query("BEGIN");

      const { bill_id } = req.params;


      // ======================================================
      // CHECK BILL
      // ======================================================

      const billResult = await client.query(
        `
        SELECT *
        FROM commercial_bill_master
        WHERE bill_id = $1
        `,
        [bill_id]
      );


      if (billResult.rows.length === 0) {

        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Commercial Bill not found"
        });

      }


      // ======================================================
      // DELETE MATERIALS
      // ======================================================

      await client.query(
        `
        DELETE FROM commercial_bill_material
        WHERE bill_id = $1
        `,
        [bill_id]
      );


      // ======================================================
      // DELETE MASTER
      // ======================================================

      const deleteResult = await client.query(
        `
        DELETE FROM commercial_bill_master
        WHERE bill_id = $1
        RETURNING *
        `,
        [bill_id]
      );


      await client.query("COMMIT");


      res.status(200).json({
        success: true,
        message: "Commercial Bill deleted successfully",
        bill: deleteResult.rows[0]
      });


    } catch (error) {

      await client.query("ROLLBACK");

      console.error(
        "DELETE COMMERCIAL BILL ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to delete Commercial Bill",
        error: error.message
      });


    } finally {

      client.release();

    }

  }
);
  


/* =========================================================
   DAY BOOK API
   Receipt_master + payment_master
   PostgreSQL / Neon
   WITHOUT async / await
   ========================================================= */

/* =========================================================
   GET TABLE COLUMNS
   ========================================================= */

function getTableColumns(tableName) {
  return pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND LOWER(table_name) = LOWER($1)
    ORDER BY ordinal_position
    `,
    [tableName]
  )
  .then(function (result) {
    return result.rows.map(function (row) {
      return row.column_name;
    });
  });
}


/* =========================================================
   FIND COLUMN
   ========================================================= */

function findColumn(columns, possibleNames) {

  var lowerColumns = columns.map(function (column) {
    return {
      original: column,
      lower: column.toLowerCase()
    };
  });

  for (var i = 0; i < possibleNames.length; i++) {

    var name = possibleNames[i].toLowerCase();

    var found = lowerColumns.find(function (column) {
      return column.lower === name;
    });

    if (found) {
      return found.original;
    }
  }

  return null;
}


/* =========================================================
   QUOTE POSTGRESQL IDENTIFIER
   ========================================================= */

function quoteIdentifier(identifier) {

  return '"' +
    String(identifier).replace(/"/g, '""') +
    '"';

}


// =========================================================
// CUSTOMER MASTER API
// =========================================================

// app.get("/api/customers", async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT
//         id,
//         customer_name
//       FROM customermaster
//       ORDER BY customer_name ASC
//     `);

//     res.json(result.rows);
//   } catch (error) {
//     console.error("CUSTOMER API ERROR:", error);

//     res.status(500).json({
//       error: "Failed to load customers",
//       details: error.message,
//     });
//   }
// });


// // =========================================================
// // CUSTOMER API
// // GET /api/customers
// // =========================================================

// app.get("/api/customers", async (req, res) => {
//   try {

//     const result = await pool.query(`
//       SELECT
//         id,
//         customer_name,
//         district,
//         state
//       FROM customermaster
//       ORDER BY customer_name ASC
//     `);

//     console.log(
//       `Customers loaded: ${result.rows.length}`
//     );

//     res.status(200).json(result.rows);

//   } catch (error) {

//     console.error(
//       "CUSTOMER API ERROR:",
//       error
//     );

//     res.status(500).json({
//       error: "Failed to load customers",
//       details: error.message,
//     });
//   }
// });



// =========================================================
// CUSTOMER MASTER API
// GET /api/customers
// =========================================================

app.get("/api/customers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        customer_name,
        district,
        state
      FROM customermaster
      ORDER BY customer_name ASC
    `);

    console.log(`Customers loaded: ${result.rows.length}`);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error("CUSTOMER API ERROR:", error);

    res.status(500).json({
      error: "Failed to load customers",
      details: error.message,
    });
  }
});

/* =========================================================
   DAY BOOK API
   ========================================================= */


   //// CONTRA REPORT


   
app.get("/api/contra-report", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // -----------------------------------------------------
    // VALIDATION
    // -----------------------------------------------------

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "From Date and To Date are required",
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message: "From Date cannot be greater than To Date",
      });
    }

    // -----------------------------------------------------
    // GET CONTRA REPORT
    // -----------------------------------------------------

    const result = await pool.query(
      `
      SELECT
        c.contra_id,
        c.voucher_no,
        c.voucher_date,
        c.narration,

        cl.line_id,
        cl.account_id,

        a.account_name,

        cl.debit,
        cl.credit,
        cl.line_narration

      FROM contra c

      INNER JOIN contra_lines cl
        ON c.contra_id = cl.contra_id

      INNER JOIN accounts a
        ON cl.account_id = a.account_id

      WHERE c.voucher_date >= $1::date
        AND c.voucher_date < ($2::date + INTERVAL '1 day')

      ORDER BY
        c.voucher_date ASC,
        c.contra_id ASC,
        cl.line_id ASC
      `,
      [fromDate, toDate]
    );

    // -----------------------------------------------------
    // RESPONSE
    // -----------------------------------------------------

    return res.status(200).json({
      success: true,
      fromDate,
      toDate,
      count: result.rows.length,
      entries: result.rows,
    });

  } catch (error) {

    console.error(
      "CONTRA REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load Contra Report",
      error: error.message,
    });
  }
});

// ============================================================
// COMMERCIAL BILL ENTRY → COMMERCIAL BILL REPORT API
// ============================================================

// ============================================================
// 1. GET ALL COMMERCIAL BILL RECORDS
// ============================================================

app.get("/api/commercial-bills", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        id,
        bill_no,
        bill_date,
        customer_name,
        customer_address,
        gstin,
        transport_mode,
        vehicle_no,
        driver_name,
        from_place,
        to_place,
        amount_in_words,
        terms,
        grand_total,
        created_at
      FROM commercialbills
      ORDER BY id DESC
    `);

    res.status(200).json(result.rows);

  } catch (error) {

    console.error(
      "GET COMMERCIAL BILLS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load commercial bill records",
      error: error.message
    });
  }
});




app.get("/api/commercial-bills/:billNo", async (req, res) => {

  try {

    const { billNo } = req.params;

    // --------------------------------------------------------
    // GET COMMERCIAL BILL HEADER
    // --------------------------------------------------------

    const headerResult = await pool.query(
      `
      SELECT
        id,
        bill_no,
        bill_date,
        customer_name,
        customer_address,
        gstin,
        transport_mode,
        vehicle_no,
        driver_name,
        from_place,
        to_place,
        amount_in_words,
        terms,
        grand_total,
        created_at
      FROM commercialbills
      WHERE bill_no = $1
      LIMIT 1
      `,
      [billNo]
    );


    // --------------------------------------------------------
    // BILL NOT FOUND
    // --------------------------------------------------------

    if (headerResult.rows.length === 0) {

      return res.status(404).json({
        success: false,
        message: `Commercial Bill ${billNo} not found`
      });

    }


    const bill = headerResult.rows[0];


    // --------------------------------------------------------
    // GET MATERIAL / ITEM RECORDS
    // --------------------------------------------------------

    const itemResult = await pool.query(
      `
      SELECT
        id,
        bill_no,
        product_code,
        product_name,
        hsn,
        uom,
        quantity,
        rate,
        discount_percent,
        discount_amount,
        taxable_amount,
        cgst,
        sgst,
        igst,
        cgst_amount,
        sgst_amount,
        igst_amount,
        amount
      FROM commercialbillitems
      WHERE bill_no = $1
      ORDER BY id ASC
      `,
      [billNo]
    );


   
    res.status(200).json({

      success: true,

      bill: {
        ...bill,

        items: itemResult.rows

      }

    });


  } catch (error) {

    console.error(
      "GET COMMERCIAL BILL DETAIL ERROR:",
      error
    );

    res.status(500).json({

      success: false,

      message: "Failed to load commercial bill",

      error: error.message

    });

  }

});




app.get(
  "/api/commercial-bills/:billNo/items",
  async (req, res) => {

    try {

      const { billNo } = req.params;

      const result = await pool.query(
        `
        SELECT
          id,
          bill_no,
          product_code,
          product_name,
          hsn,
          uom,
          quantity,
          rate,
          discount_percent,
          discount_amount,
          taxable_amount,
          cgst,
          sgst,
          igst,
          cgst_amount,
          sgst_amount,
          igst_amount,
          amount
        FROM commercialbillitems
        WHERE bill_no = $1
        ORDER BY id ASC
        `,
        [billNo]
      );

      res.status(200).json({
        success: true,
        items: result.rows
      });

    } catch (error) {

      console.error(
        "GET COMMERCIAL BILL ITEMS ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to load commercial bill items",
        error: error.message
      });

    }

  }
);

// =========================================================
// =========================================================
// =========================================================
// DAY BOOK REPORT API
// PAYMENT + RECEIPT
// =========================================================

app.get("/api/daybook", async (req, res) => {
  try {
    const {
      fromDate = "",
      toDate = "",
      entryType = "ALL",
      search = "",
    } = req.query;

    let query = `
      SELECT
        id,
        entry_date,
        voucher_no,
        entry_type,
        account_name,
        payment_mode,
        amount
      FROM paymentreceipt
      WHERE 1 = 1
    `;

    const values = [];
    let index = 1;

    // -----------------------------------------------------
    // FROM DATE
    // -----------------------------------------------------
    if (fromDate) {
      query += ` AND entry_date::date >= $${index}`;
      values.push(fromDate);
      index++;
    }

    // -----------------------------------------------------
    // TO DATE
    // -----------------------------------------------------
    if (toDate) {
      query += ` AND entry_date::date <= $${index}`;
      values.push(toDate);
      index++;
    }

    // -----------------------------------------------------
    // ENTRY TYPE
    // -----------------------------------------------------
    if (entryType && entryType !== "ALL") {
      query += `
        AND UPPER(TRIM(entry_type)) = UPPER(TRIM($${index}))
      `;

      values.push(entryType);
      index++;
    }

    // -----------------------------------------------------
    // SEARCH
    // Voucher / Account / Payment Mode
    // -----------------------------------------------------
    if (search.trim()) {
      query += `
        AND (
          COALESCE(voucher_no::text, '') ILIKE $${index}
          OR COALESCE(account_name::text, '') ILIKE $${index}
          OR COALESCE(payment_mode::text, '') ILIKE $${index}
          OR COALESCE(entry_type::text, '') ILIKE $${index}
        )
      `;

      values.push(`%${search.trim()}%`);
      index++;
    }

    // -----------------------------------------------------
    // ORDER
    // -----------------------------------------------------
    query += `
      ORDER BY entry_date ASC, id ASC
    `;

    const result = await pool.query(query, values);

    // -----------------------------------------------------
    // CONVERT TO DAY BOOK FORMAT
    // -----------------------------------------------------
    const rows = result.rows.map((row) => {
      const amount = Number(row.amount || 0);

      const type = String(row.entry_type || "")
        .trim()
        .toUpperCase();

      let receipt = 0;
      let payment = 0;

      if (
        type === "RECEIPT" ||
        type === "CREDIT" ||
        type === "CR"
      ) {
        receipt = amount;
      }

      if (
        type === "PAYMENT" ||
        type === "DEBIT" ||
        type === "DR"
      ) {
        payment = amount;
      }

      return {
        id: row.id,

        date: row.entry_date,

        voucherNo: row.voucher_no,

        type:
          type === "RECEIPT" ||
          type === "CREDIT" ||
          type === "CR"
            ? "RECEIPT"
            : "PAYMENT",

        accountName: row.account_name || "-",

        particulars: "-",

        mode: row.payment_mode || "CASH",

        receipt,

        payment,
      };
    });

    // -----------------------------------------------------
    // TOTALS
    // -----------------------------------------------------
    const totalReceipt = rows.reduce(
      (sum, row) => sum + Number(row.receipt || 0),
      0
    );

    const totalPayment = rows.reduce(
      (sum, row) => sum + Number(row.payment || 0),
      0
    );

    // -----------------------------------------------------
    // RESPONSE
    // -----------------------------------------------------
    res.json({
      success: true,

      data: rows,

      totalReceipt,

      totalPayment,

      count: rows.length,
    });

  } catch (error) {
    console.error("DAY BOOK API ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load Day Book",
      error: error.message,
    });
  }
});


//// SALES ENTRY

app.get("/api/sales/next-number", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT invoice_no
      FROM salesentry
      ORDER BY id DESC
      LIMIT 1
    `);

    let nextNumber = 1;

    if (result.rows.length > 0) {

      const lastInvoice =
        result.rows[0].invoice_no;

      const number =
        parseInt(
          String(lastInvoice).replace(/\D/g, ""),
          10
        );

      if (!isNaN(number)) {
        nextNumber = number + 1;
      }
    }

    const invoiceNo =
      "S" +
      String(nextNumber).padStart(5, "0");

    res.json({
      invoiceNo
    });

  } catch (error) {

    console.error(
      "NEXT SALES NUMBER ERROR:",
      error
    );

    res.status(500).json({
      message: "Unable to generate sales number",
      error: error.message
    });
  }
});


// ============================================================
// PRODUCTS FOR SALES
// ============================================================

app.get("/api/sales/products", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        pm.productcode,
        pm.productname,
        pm.productuom,

        COALESCE(
          pm.sales_rate,
          0
        ) AS sales_rate

      FROM productmaster pm

      ORDER BY pm.productname ASC
    `);

    res.json(result.rows);

  } catch (error) {

    console.error(
      "SALES PRODUCTS ERROR:",
      error
    );

    res.status(500).json({
      message: "Failed to load sales products",
      error: error.message
    });
  }
});


// ============================================================
// SAVE SALES
// ============================================================

app.post("/api/sales", async (req, res) => {

  const client = await pool.connect();

  try {

    const {
      invoiceNo,
      invoiceDate,
      customerId,
      customerName,
      referenceNo,
      paymentMode,

      subtotal,
      discountTotal,
      taxableTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      grandTotal,

      items
    } = req.body;


    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!invoiceNo) {
      return res.status(400).json({
        message: "Invoice number required"
      });
    }

    if (!invoiceDate) {
      return res.status(400).json({
        message: "Invoice date required"
      });
    }

    if (!customerName) {
      return res.status(400).json({
        message: "Customer required"
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "At least one product required"
      });
    }


    await client.query("BEGIN");


    // ------------------------------------------
    // CHECK DUPLICATE
    // ------------------------------------------

    const duplicate =
      await client.query(
        `
        SELECT id
        FROM salesentry
        WHERE invoice_no = $1
        `,
        [invoiceNo]
      );

    if (duplicate.rows.length > 0) {

      await client.query("ROLLBACK");

      return res.status(409).json({
        message:
          `Invoice ${invoiceNo} already exists`
      });
    }


    // ------------------------------------------
    // SALES HEADER
    // ------------------------------------------

    const header =
      await client.query(
        `
        INSERT INTO salesentry
        (
          invoice_no,
          invoice_date,
          customer_id,
          customer_name,
          reference_no,
          payment_mode,

          subtotal,
          discount_total,
          taxable_total,
          cgst_total,
          sgst_total,
          igst_total,
          grand_total
        )

        VALUES
        (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,$13
        )

        RETURNING id
        `,
        [
          invoiceNo,
          invoiceDate,
          customerId || null,
          customerName,
          referenceNo || null,
          paymentMode || "CASH",

          Number(subtotal || 0),
          Number(discountTotal || 0),
          Number(taxableTotal || 0),
          Number(cgstTotal || 0),
          Number(sgstTotal || 0),
          Number(igstTotal || 0),
          Number(grandTotal || 0)
        ]
      );


    const salesId =
      header.rows[0].id;


    // ------------------------------------------
    // SALES ITEMS
    // ------------------------------------------

    for (const item of items) {

      const quantity =
        Number(item.quantity || 0);

      const rate =
        Number(item.rate || 0);

      const discountPercent =
        Number(item.discount_percent || 0);

      const cgstPercent =
        Number(item.cgst_percent || 0);

      const sgstPercent =
        Number(item.sgst_percent || 0);

      const igstPercent =
        Number(item.igst_percent || 0);


      // ----------------------------------------
      // CALCULATIONS
      // ----------------------------------------

      const gross =
        quantity * rate;

      const discountAmount =
        gross *
        discountPercent /
        100;

      const taxableValue =
        gross -
        discountAmount;

      const cgstAmount =
        taxableValue *
        cgstPercent /
        100;

      const sgstAmount =
        taxableValue *
        sgstPercent /
        100;

      const igstAmount =
        taxableValue *
        igstPercent /
        100;

      const total =
        taxableValue +
        cgstAmount +
        sgstAmount +
        igstAmount;


      // ----------------------------------------
      // INSERT ITEM
      // ----------------------------------------

      await client.query(
        `
        INSERT INTO salesentry_items
        (
          sales_id,

          product_code,
          product_name,
          hsn_code,
          uom,

          quantity,
          rate,
          discount_percent,

          taxable_value,

          cgst_percent,
          cgst_amount,

          sgst_percent,
          sgst_amount,

          igst_percent,
          igst_amount,

          total
        )

        VALUES
        (
          $1,

          $2,$3,$4,$5,

          $6,$7,$8,

          $9,

          $10,$11,

          $12,$13,

          $14,$15,

          $16
        )
        `,
        [
          salesId,

          item.product_code || null,
          item.product_name,
          item.hsn_code || null,
          item.uom || null,

          quantity,
          rate,
          discountPercent,

          taxableValue,

          cgstPercent,
          cgstAmount,

          sgstPercent,
          sgstAmount,

          igstPercent,
          igstAmount,

          total
        ]
      );
    }


    await client.query("COMMIT");


    res.status(201).json({
      success: true,
      message:
        `Sales ${invoiceNo} saved successfully`,
      invoiceNo
    });


  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "SAVE SALES ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to save sales",
      error: error.message
    });

  } finally {

    client.release();

  }
});


// ============================================================
// LOAD SALES INVOICE
// ============================================================

app.get(
  "/api/sales/:invoiceNo",
  async (req, res) => {

    try {

      const invoiceNo =
        req.params.invoiceNo;


      const header =
        await pool.query(
          `
          SELECT *
          FROM salesentry
          WHERE invoice_no = $1
          `,
          [invoiceNo]
        );


      if (header.rows.length === 0) {

        return res.status(404).json({
          message:
            `Invoice ${invoiceNo} not found`
        });
      }


      const sales =
        header.rows[0];


      const items =
        await pool.query(
          `
          SELECT
            id,
            product_code,
            product_name,
            hsn_code,
            uom,

            quantity,
            rate,
            discount_percent,

            taxable_value,

            cgst_percent,
            cgst_amount,

            sgst_percent,
            sgst_amount,

            igst_percent,
            igst_amount,

            total

          FROM salesentry_items

          WHERE sales_id = $1

          ORDER BY id
          `,
          [sales.id]
        );


      res.json({
        ...sales,
        items: items.rows
      });


    } catch (error) {

      console.error(
        "LOAD SALES ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load sales",
        error: error.message
      });
    }
  }
);


// ============================================================
// UPDATE SALES
// ============================================================

app.put(
  "/api/sales/:invoiceNo",
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const invoiceNo =
        req.params.invoiceNo;

      const {
        invoiceDate,
        customerId,
        customerName,
        referenceNo,
        paymentMode,

        subtotal,
        discountTotal,
        taxableTotal,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,

        items
      } = req.body;


      await client.query("BEGIN");


      const existing =
        await client.query(
          `
          SELECT id
          FROM salesentry
          WHERE invoice_no = $1
          `,
          [invoiceNo]
        );


      if (existing.rows.length === 0) {

        await client.query("ROLLBACK");

        return res.status(404).json({
          message:
            `Invoice ${invoiceNo} not found`
        });
      }


      const salesId =
        existing.rows[0].id;


      // ----------------------------------------
      // UPDATE HEADER
      // ----------------------------------------

      await client.query(
        `
        UPDATE salesentry

        SET
          invoice_date = $1,
          customer_id = $2,
          customer_name = $3,
          reference_no = $4,
          payment_mode = $5,

          subtotal = $6,
          discount_total = $7,
          taxable_total = $8,
          cgst_total = $9,
          sgst_total = $10,
          igst_total = $11,
          grand_total = $12

        WHERE invoice_no = $13
        `,
        [
          invoiceDate,
          customerId || null,
          customerName,
          referenceNo || null,
          paymentMode || "CASH",

          Number(subtotal || 0),
          Number(discountTotal || 0),
          Number(taxableTotal || 0),
          Number(cgstTotal || 0),
          Number(sgstTotal || 0),
          Number(igstTotal || 0),
          Number(grandTotal || 0),

          invoiceNo
        ]
      );


      // ----------------------------------------
      // DELETE OLD ITEMS
      // ----------------------------------------

      await client.query(
        `
        DELETE FROM salesentry_items
        WHERE sales_id = $1
        `,
        [salesId]
      );


      // ----------------------------------------
      // INSERT NEW ITEMS
      // ----------------------------------------

      for (const item of items) {

        const quantity =
          Number(item.quantity || 0);

        const rate =
          Number(item.rate || 0);

        const discountPercent =
          Number(item.discount_percent || 0);

        const cgstPercent =
          Number(item.cgst_percent || 0);

        const sgstPercent =
          Number(item.sgst_percent || 0);

        const igstPercent =
          Number(item.igst_percent || 0);


        const gross =
          quantity * rate;

        const discountAmount =
          gross *
          discountPercent /
          100;

        const taxableValue =
          gross -
          discountAmount;

        const cgstAmount =
          taxableValue *
          cgstPercent /
          100;

        const sgstAmount =
          taxableValue *
          sgstPercent /
          100;

        const igstAmount =
          taxableValue *
          igstPercent /
          100;

        const total =
          taxableValue +
          cgstAmount +
          sgstAmount +
          igstAmount;


        await client.query(
          `
          INSERT INTO salesentry_items
          (
            sales_id,

            product_code,
            product_name,
            hsn_code,
            uom,

            quantity,
            rate,
            discount_percent,

            taxable_value,

            cgst_percent,
            cgst_amount,

            sgst_percent,
            sgst_amount,

            igst_percent,
            igst_amount,

            total
          )

          VALUES
          (
            $1,

            $2,$3,$4,$5,

            $6,$7,$8,

            $9,

            $10,$11,

            $12,$13,

            $14,$15,

            $16
          )
          `,
          [
            salesId,

            item.product_code || null,
            item.product_name,
            item.hsn_code || null,
            item.uom || null,

            quantity,
            rate,
            discountPercent,

            taxableValue,

            cgstPercent,
            cgstAmount,

            sgstPercent,
            sgstAmount,

            igstPercent,
            igstAmount,

            total
          ]
        );
      }


      await client.query("COMMIT");


      res.json({
        success: true,
        message:
          `Sales ${invoiceNo} updated successfully`
      });


    } catch (error) {

      await client.query("ROLLBACK");

      console.error(
        "UPDATE SALES ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update sales",
        error: error.message
      });

    } finally {

      client.release();

    }
  }
);


// ============================================================
// DELETE SALES
// ============================================================

app.delete(
  "/api/sales/:invoiceNo",
  async (req, res) => {

    try {

      const invoiceNo =
        req.params.invoiceNo;


      const result =
        await pool.query(
          `
          DELETE FROM salesentry
          WHERE invoice_no = $1

          RETURNING id
          `,
          [invoiceNo]
        );


      if (result.rows.length === 0) {

        return res.status(404).json({
          message:
            `Invoice ${invoiceNo} not found`
        });
      }


      res.json({
        success: true,
        message:
          `Sales ${invoiceNo} deleted successfully`
      });


    } catch (error) {

      console.error(
        "DELETE SALES ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete sales",
        error: error.message
      });
    }
  }
);


/// PURCHASE ENTRY


// =========================================================
// PURCHASE ENTRY API
// =========================================================

// =========================================================
// NEXT PURCHASE NUMBER
// P00001, P00002, P00003...
// =========================================================

app.get("/api/purchases/next-number", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT purchase_no
      FROM purchase_entry
      WHERE purchase_no LIKE 'P%'
      ORDER BY id DESC
      LIMIT 1
    `);

    let nextNumber = 1;

    if (result.rows.length > 0) {
      const lastNo = result.rows[0].purchase_no;

      const numberPart = parseInt(
        lastNo.replace("P", ""),
        10
      );

      if (!isNaN(numberPart)) {
        nextNumber = numberPart + 1;
      }
    }

    const purchaseNo =
      "P" + String(nextNumber).padStart(5, "0");

    res.json({
      purchase_no: purchaseNo,
    });
  } catch (error) {
    console.error(
      "Next purchase number error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to generate purchase number",
    });
  }
});

// =========================================================
// GET ALL PURCHASES
// =========================================================

app.get("/api/purchases", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        purchase_no,
        purchase_date,
        supplier_name,
        invoice_no,
        invoice_date,
        payment_mode,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_amount,
        remarks,
        created_at
      FROM purchase_entry
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Purchase list error:",
      error
    );

    res.status(500).json({
      message: "Failed to load purchases",
    });
  }
});

// =========================================================
// GET SINGLE PURCHASE
// =========================================================

app.get(
  "/api/purchases/:purchaseNo",
  async (req, res) => {
    const { purchaseNo } = req.params;

    try {
      const headerResult = await pool.query(
        `
        SELECT *
        FROM purchase_entry
        WHERE purchase_no = $1
        LIMIT 1
        `,
        [purchaseNo]
      );

      if (headerResult.rows.length === 0) {
        return res.status(404).json({
          message:
            "Purchase not found",
        });
      }

      const header =
        headerResult.rows[0];

      const itemsResult = await pool.query(
        `
        SELECT
          product_code,
          product_name,
          uom,
          quantity,
          rate,
          discount_percent,
          cgst_percent,
          sgst_percent,
          igst_percent,
          taxable_amount,
          cgst_amount,
          sgst_amount,
          igst_amount,
          total_amount
        FROM purchase_entry
        WHERE purchase_no = $1
        ORDER BY id ASC
        `,
        [purchaseNo]
      );

      res.json({
        purchase: {
          ...header,
          items: itemsResult.rows,
        },
      });
    } catch (error) {
      console.error(
        "Single purchase error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load purchase",
      });
    }
  }
);

// =========================================================
// CREATE PURCHASE
// =========================================================

app.post("/api/purchases", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      purchase_no,
      purchase_date,
      supplier_name,
      invoice_no,
      invoice_date,
      payment_mode,
      remarks,
      items,
      taxable_amount,
      cgst_amount,
      sgst_amount,
      igst_amount,
      total_amount,
    } = req.body;

    // ---------------------------------------------
    // VALIDATION
    // ---------------------------------------------

    if (!purchase_no) {
      return res.status(400).json({
        message:
          "Purchase number is required",
      });
    }

    if (!purchase_date) {
      return res.status(400).json({
        message:
          "Purchase date is required",
      });
    }

    if (!supplier_name) {
      return res.status(400).json({
        message:
          "Supplier is required",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one product is required",
      });
    }

    await client.query("BEGIN");

    // ---------------------------------------------
    // CHECK DUPLICATE
    // ---------------------------------------------

    const duplicate =
      await client.query(
        `
        SELECT id
        FROM purchase_entry
        WHERE purchase_no = $1
        LIMIT 1
        `,
        [purchase_no]
      );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message:
          `Purchase ${purchase_no} already exists`,
      });
    }

    // ---------------------------------------------
    // INSERT ITEMS
    // ---------------------------------------------

    for (const row of items) {
      const quantity =
        Number(row.quantity) || 0;

      const rate =
        Number(row.rate) || 0;

      const discountPercent =
        Number(
          row.discount_percent
        ) || 0;

      const cgstPercent =
        Number(row.cgst_percent) || 0;

      const sgstPercent =
        Number(row.sgst_percent) || 0;

      const igstPercent =
        Number(row.igst_percent) || 0;

      const gross =
        quantity * rate;

      const discount =
        gross *
        (discountPercent / 100);

      const taxable =
        gross - discount;

      const cgst =
        taxable *
        (cgstPercent / 100);

      const sgst =
        taxable *
        (sgstPercent / 100);

      const igst =
        taxable *
        (igstPercent / 100);

      const total =
        taxable +
        cgst +
        sgst +
        igst;

      await client.query(
        `
        INSERT INTO purchase_entry (
          purchase_no,
          purchase_date,
          supplier_name,
          invoice_no,
          invoice_date,
          payment_mode,
          product_code,
          product_name,
          uom,
          quantity,
          rate,
          discount_percent,
          cgst_percent,
          sgst_percent,
          igst_percent,
          taxable_amount,
          cgst_amount,
          sgst_amount,
          igst_amount,
          total_amount,
          remarks
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18,
          $19,$20,$21
        )
        `,
        [
          purchase_no,
          purchase_date,
          supplier_name,
          invoice_no || null,
          invoice_date || null,
          payment_mode || "CASH",

          row.product_code || null,
          row.product_name || "",
          row.uom || "KG",

          quantity,
          rate,

          discountPercent,
          cgstPercent,
          sgstPercent,
          igstPercent,

          taxable.toFixed(2),
          cgst.toFixed(2),
          sgst.toFixed(2),
          igst.toFixed(2),
          total.toFixed(2),

          remarks || null,
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message:
        "Purchase saved successfully",
      purchase_no,
      taxable_amount:
        Number(taxable_amount) || 0,
      cgst_amount:
        Number(cgst_amount) || 0,
      sgst_amount:
        Number(sgst_amount) || 0,
      igst_amount:
        Number(igst_amount) || 0,
      total_amount:
        Number(total_amount) || 0,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Save purchase error:",
      error
    );

    res.status(500).json({
      message:
        error.message ||
        "Failed to save purchase",
    });
  } finally {
    client.release();
  }
});

// =========================================================
// UPDATE PURCHASE
// =========================================================

app.put(
  "/api/purchases/:purchaseNo",
  async (req, res) => {
    const client = await pool.connect();

    const { purchaseNo } = req.params;

    try {
      const {
        purchase_date,
        supplier_name,
        invoice_no,
        invoice_date,
        payment_mode,
        remarks,
        items,
      } = req.body;

      if (!supplier_name) {
        return res.status(400).json({
          message:
            "Supplier is required",
        });
      }

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          message:
            "At least one product is required",
        });
      }

      await client.query("BEGIN");

      const existing =
        await client.query(
          `
          SELECT id
          FROM purchase_entry
          WHERE purchase_no = $1
          LIMIT 1
          `,
          [purchaseNo]
        );

      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message:
            "Purchase not found",
        });
      }

      // Delete old rows
      await client.query(
        `
        DELETE FROM purchase_entry
        WHERE purchase_no = $1
        `,
        [purchaseNo]
      );

      // Insert updated rows
      for (const row of items) {
        const quantity =
          Number(row.quantity) || 0;

        const rate =
          Number(row.rate) || 0;

        const discountPercent =
          Number(
            row.discount_percent
          ) || 0;

        const cgstPercent =
          Number(row.cgst_percent) || 0;

        const sgstPercent =
          Number(row.sgst_percent) || 0;

        const igstPercent =
          Number(row.igst_percent) || 0;

        const gross =
          quantity * rate;

        const discount =
          gross *
          (discountPercent / 100);

        const taxable =
          gross - discount;

        const cgst =
          taxable *
          (cgstPercent / 100);

        const sgst =
          taxable *
          (sgstPercent / 100);

        const igst =
          taxable *
          (igstPercent / 100);

        const total =
          taxable +
          cgst +
          sgst +
          igst;

        await client.query(
          `
          INSERT INTO purchase_entry (
            purchase_no,
            purchase_date,
            supplier_name,
            invoice_no,
            invoice_date,
            payment_mode,
            product_code,
            product_name,
            uom,
            quantity,
            rate,
            discount_percent,
            cgst_percent,
            sgst_percent,
            igst_percent,
            taxable_amount,
            cgst_amount,
            sgst_amount,
            igst_amount,
            total_amount,
            remarks
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,$10,$11,$12,
            $13,$14,$15,$16,$17,$18,
            $19,$20,$21
          )
          `,
          [
            purchaseNo,
            purchase_date,
            supplier_name,
            invoice_no || null,
            invoice_date || null,
            payment_mode || "CASH",

            row.product_code || null,
            row.product_name || "",
            row.uom || "KG",

            quantity,
            rate,

            discountPercent,
            cgstPercent,
            sgstPercent,
            igstPercent,

            taxable.toFixed(2),
            cgst.toFixed(2),
            sgst.toFixed(2),
            igst.toFixed(2),
            total.toFixed(2),

            remarks || null,
          ]
        );
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        message:
          "Purchase updated successfully",
        purchase_no: purchaseNo,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Update purchase error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Failed to update purchase",
      });
    } finally {
      client.release();
    }
  }
);

// =========================================================
// DELETE PURCHASE
// =========================================================

app.delete(
  "/api/purchases/:purchaseNo",
  async (req, res) => {
    const { purchaseNo } = req.params;

    try {
      const result = await pool.query(
        `
        DELETE FROM purchase_entry
        WHERE purchase_no = $1
        RETURNING purchase_no
        `,
        [purchaseNo]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "Purchase not found",
        });
      }

      res.json({
        success: true,
        message:
          "Purchase deleted successfully",
        purchase_no: purchaseNo,
      });
    } catch (error) {
      console.error(
        "Delete purchase error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete purchase",
      });
    }
  }
);

// =========================================================
// SERVER
// =========================================================
// =====================================================
// SUPPLIER MASTER API
// =====================================================

// GET ALL SUPPLIERS
app.get("/api/suppliers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        supplier_name,
        city,
        district,
        state,
        phone,
        gstin,
        address
      FROM supplier_master
      ORDER BY supplier_name ASC
    `);

    console.log(`Suppliers loaded: ${result.rows.length}`);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error("SUPPLIER API ERROR:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load suppliers",
      details: error.message,
    });
  }
});


// GET SINGLE SUPPLIER
app.get("/api/suppliers/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        supplier_name,
        city,
        district,
        state,
        phone,
        gstin,
        address
      FROM supplier_master
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Supplier not found",
      });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error("SUPPLIER SINGLE API ERROR:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load supplier",
      details: error.message,
    });
  }
});


// ADD SUPPLIER
app.post("/api/suppliers", async (req, res) => {
  try {
    const {
      supplier_name,
      city,
      district,
      state,
      phone,
      gstin,
      address,
    } = req.body;

    if (!supplier_name || !supplier_name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Supplier name is required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO supplier_master
      (
        supplier_name,
        city,
        district,
        state,
        phone,
        gstin,
        address
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        supplier_name.trim(),
        city || "Salem",
        district || "Salem",
        state || "Tamil Nadu",
        phone || "",
        gstin || "",
        address || "",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Supplier added successfully",
      supplier: result.rows[0],
    });

  } catch (error) {
    console.error("SUPPLIER INSERT ERROR:", error);

    res.status(500).json({
      success: false,
      error: "Failed to add supplier",
      details: error.message,
    });
  }
});


// =====================================================
// PRODUCT MASTER API
// =====================================================

app.get("/api/productmaster", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        productcode,
        productname,
        productuom,
        productheadcode,
        COALESCE(sales_rate, 0) AS sales_rate
      FROM productmaster
      ORDER BY productname ASC
    `);

    console.log(`Product Master loaded: ${result.rows.length}`);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error("PRODUCT MASTER API ERROR:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load product master",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  
  console.log(`🚀 Server Running on Port ${PORT}`);
 
});

