const express = require("express");
const app = express();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const path = require("path");
const fs = require("fs").promises;
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const connection = mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "wpr",
  password: "fit2023",
  database: "wpr2023",
});

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(cookieParser());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

function authenticateUser(req, res, next) {
  const userEmail = req.cookies.user;

  if (userEmail) {
    return next();
  } else {
    res.status(403).render("access-denied");
  }
}

app.get("/", (req, res) => {
  const user = req.cookies.user;
  if (user) {
    res.redirect("/inbox");
  } else {
    res.render("signIn");
  }
});

app.post("/", (req, res) => {
  const { email, password } = req.body;
  connection.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
    (err, results) => {
      if (err) {
        console.error("Error ", err);
        return res.status(500).send("Error");
      }

      if (results.length > 0) {
        const user = results[0];
        if (password === user.password) {
          res.cookie("user", user.fullName, { maxAge: 3600000 });
          return res.redirect("/inbox");
        } else {
          res.render("signin", { error: "Invalid email or password" });
        }
      } else {
        res.render("signin", { error: "Invalid email or password" });
      }
    }
  );
});

app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", (req, res) => {
  const { fullName, email, password, confirmPassword } = req.body;

  if (!fullName || !email || !password || !confirmPassword) {
    return res.render("signup", { error: "Please fill in all fields." });
  }

  if (password.length < 6) {
    return res.render("signup", {
      error: "Password should be at least 6 characters.",
    });
  }

  if (password !== confirmPassword) {
    return res.render("signup", { error: "Passwords do not match." });
  }
  connection.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
    (err, results) => {
      if (err) {
        console.error("Error during sign-up:", err);
        return res.status(500).send("Internal Server Error");
      }

      if (results.length > 0) {
        return res.render("signup", {
          error: "Email address is already in use.",
        });
      }
      connection.query(
        "INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)",
        [fullName, email, password],
        (err) => {
          if (err) {
            console.error("Error during sign-up:", err);
            return res.status(500).send("Internal Server Error");
          }
          res.render("welcome", { fullName });
        }
      );
    }
  );
});

app.get("/signout", (req, res) => {
  res.clearCookie("user");
  res.redirect("/");
});

async function getEmailsByPage(userId, page, pageSize) {
  try {
    const offset = (page - 1) * pageSize;
    const [rows] = connection.query(
      "SELECT * FROM messages WHERE receiver_id = ? ORDER BY timeSent DESC LIMIT ?, ?",
      [userId, offset, pageSize]
    );
    return rows;
  } catch (error) {
    console.error("Error in getEmailsByPage:", error);
    throw error;
  }
}

app.get("/inbox", authenticateUser, (req, res) => {
  const signedInUser = req.cookies.user;
  const pag = parseInt(req.query.pag) || 1;
  const emailsPerPage = 5;

  const query = `
      SELECT messages.*, users.fullName AS sender_full_name
      FROM messages
      JOIN users ON messages.sender_id = users.id
      WHERE receiver_id = (SELECT id FROM users WHERE fullName = ?)
      AND messages.deleted = false
      ORDER BY timeSent DESC
      LIMIT ?, ?;
    `;

  connection.query(
    query,
    [signedInUser, (pag - 1) * emailsPerPage, emailsPerPage],
    (err, results) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).send("Internal Server Error");
      }

      console.log("Results from database:", results);

      connection.query(
        "SELECT COUNT(*) AS total FROM messages WHERE receiver_id = (SELECT id FROM users WHERE fullName = ?) AND deleted = false",
        [signedInUser],
        (err, countResult) => {
          if (err) {
            console.error("Database error:", err.message);
            return res.status(500).send("Internal Server Error");
          }

          console.log("Count result from database:", countResult);

          const totalEmails = countResult[0].total;
          const totalPages = Math.ceil(totalEmails / emailsPerPage);

          res.render("inbox", {
            emails: results,
            currentPage: pag,
            totalPages: totalPages,
            username: signedInUser,
          });
        }
      );
    }
  );
});

app.post("/api/delete-emails", authenticateUser, async (req, res) => {
  const signedInUser = req.cookies.user;
  const emailIdsToDelete = req.body.emailIds;

  try {
    // Check if emailIdsToDelete is defined and an array
    if (!Array.isArray(emailIdsToDelete)) {
      return res
        .status(400)
        .send("Invalid or missing emailIds in the request.");
    }

    // Filter out undefined values from the emailIdsToDelete array
    const filteredEmailIds = emailIdsToDelete.filter((id) => id !== undefined);

    // Check if there are valid emailIds to delete
    if (filteredEmailIds.length === 0) {
      return res.status(400).send("No valid emailIds to delete.");
    }

    // Build the SQL query with dynamic placeholders
    const placeholders = filteredEmailIds.map(() => "?").join(",");
    const query = `
        UPDATE messages
        SET deleted = true
        WHERE id IN (${placeholders})
        AND receiver_id = (SELECT id FROM users WHERE fullName = ?)
      `;

    // Execute the update operation in the database
    await connection.query(query, [...filteredEmailIds, signedInUser]);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting outbox emails:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/compose", authenticateUser, (req, res) => {
  const signedInUser = req.cookies.user;
  connection.query("SELECT * FROM users", (err, results) => {
    if (err) {
      res.render("err");
    } else {
      res.render("compose", {
        results: results,
        username: signedInUser,
      });
    }
  });
});

app.post("/compose", authenticateUser, upload.single("file"), (req, res) => {
  const signedInUser = req.cookies.user;
  const { receiver_id, title, content } = req.body;
  const receiverId = parseInt(receiver_id, 10);
  // Name the file to be unique
  const timestamp = Date.now();
  const fileExtension = req.file
    ? req.file.originalname.split(".").pop()
    : null;
  const uniqueFilename = `${timestamp}.${fileExtension}`;
  // Fetch the id
  const senderIdQuery = "SELECT id FROM users WHERE fullName = ?";
  connection.query(senderIdQuery, [signedInUser], (err, result) => {
    if (err) {
      console.error("Error fetching sender id:", err);
      return res.status(500).send("Internal Server Error");
    }
    const senderId = result[0].id;
    const mainQuery =
      "INSERT INTO messages (sender_id, receiver_id, content, file, title, timeReceived, timeSent) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";
    const values = [senderId, receiverId, content, uniqueFilename, title];
    connection.query(mainQuery, values, (err) => {
      if (err) {
        console.error("Error inserting message:", err);
        res.send("err");
      } else {
        // Move the file
        if (req.file) {
          const oldPath = `uploads/${req.file.filename}`;
          const newPath = `uploads/${uniqueFilename}`;

          fs.rename(oldPath, newPath)
            .then(() => {
              res.redirect("/inbox");
            })
            .catch((error) => {
              console.error("Error renaming file:", error);
              res.send("err");
            });
        } else {
          res.redirect("/inbox");
        }
      }
    });
  });
});

app.get("/email/:id", authenticateUser, (req, res) => {
  const signedInUser = req.cookies.user;
  const emailId = req.params.id;

  connection.query(
    "SELECT content, title, file FROM messages WHERE messages.id = ?",
    emailId,
    (err, results) => {
      if (err) {
        return res.status(500).send("Internal Server Error");
      } else {
        res.render("email-detail", {
          username: signedInUser,
          emailDetail: results[0],
        });
      }
    }
  );
});

app.get("/outbox", authenticateUser, (req, res) => {
  const signedInUser = req.cookies.user;
  const pag = parseInt(req.query.pag) || 1;
  const emailsPerPage = 5;

  const query = `
    SELECT messages.*, users.fullName AS recipient_full_name
    FROM messages
    JOIN users ON messages.receiver_id = users.id
    WHERE sender_id = (SELECT id FROM users WHERE fullName = ?)
    AND messages.deleted2 = false  
    ORDER BY timeSent DESC
    LIMIT ?, ?;
  `;

  connection.query(
    query,
    [signedInUser, (pag - 1) * emailsPerPage, emailsPerPage],
    (err, results) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).send("Internal Server Error");
      }

      console.log("Results from database:", results);

      connection.query(
        "SELECT COUNT(*) AS total FROM messages WHERE sender_id = (SELECT id FROM users WHERE fullName = ?) AND deleted2 = false",
        [signedInUser],
        (err, countResult) => {
          if (err) {
            console.error("Database error:", err.message);
            return res.status(500).send("Internal Server Error");
          }

          console.log("Count result from database:", countResult);

          const totalEmails = countResult[0].total;
          const totalPages = Math.ceil(totalEmails / emailsPerPage);

          res.render("outbox", {
            emails: results,
            currentPage: pag,
            totalPages: totalPages,
            username: signedInUser,
          });
        }
      );
    }
  );
});

app.post("/api/delete-outbox-emails", authenticateUser, async (req, res) => {
  const signedInUser = req.cookies.user;
  const emailIdsToDelete = req.body.emailIds;

  try {
    // Check if emailIdsToDelete is defined and an array
    if (!Array.isArray(emailIdsToDelete)) {
      return res
        .status(400)
        .send("Invalid or missing emailIds in the request.");
    }

    // Filter out undefined values from the emailIdsToDelete array
    const filteredEmailIds = emailIdsToDelete.filter((id) => id !== undefined);

    // Check if there are valid emailIds to delete
    if (filteredEmailIds.length === 0) {
      return res.status(400).send("No valid emailIds to delete.");
    }

    const placeholders = filteredEmailIds.map(() => "?").join(",");
    const query = `
      UPDATE messages
      SET deleted2 = true
      WHERE id IN (${placeholders})
      AND sender_id = (SELECT id FROM users WHERE fullName = ?)
    `;

    connection.query(query, [...filteredEmailIds, signedInUser]);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting outbox emails:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/download/:filename", authenticateUser, (req, res) => {
  const signedInUser = req.cookies.user;
  const filename = req.params.filename;

  connection.query(
    "SELECT file FROM messages WHERE file = ? AND receiver_id = (SELECT id FROM users WHERE fullName = ?)",
    [filename, signedInUser],
    (err, result) => {
      if (err) {
        console.error("Error checking file access:", err);
        return res.status(500).send("Internal Server Error");
      }
      if (result.length === 0) {
        return res.status(403).send("Access Denied");
      }
      const filePath = path.join(__dirname, "uploads", filename);
      res.download(filePath, filename, (err) => {
        if (err) {
          console.error("Error during download:", err);
          res.status(500).send("Internal Server Error");
        }
      });
    }
  );
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
