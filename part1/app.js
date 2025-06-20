var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');

var app = express();

// API Routes
const dogsRouter = require('./routes/dogs');
const walkersRouter = require('./routes/walkers');
const walkRequestsRouter = require('./routes/walkRequests');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;


(async () => {
  try {
    // Connect to MySQL server without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '' // Your MySQL root password
    });

    // Create DogWalkService database if not exists
    await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await connection.end();

    // Connect to DogWalkService database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService'
    });

    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('owner', 'walker') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS Dogs (
        dog_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        size ENUM('small', 'medium', 'large') NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES Users(user_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRequests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        dog_id INT NOT NULL,
        requested_time DATETIME NOT NULL,
        duration_minutes INT NOT NULL,
        location VARCHAR(255) NOT NULL,
        status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkApplications (
        application_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        CONSTRAINT unique_application UNIQUE (request_id, walker_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRatings (
        rating_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        owner_id INT NOT NULL,
        rating INT CHECK (rating BETWEEN 1 AND 5),
        comments TEXT,
        rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        FOREIGN KEY (owner_id) REFERENCES Users(user_id),
        CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
      )
    `);

    // Insert Users (if not exists)
    const [userCount] = await db.execute('SELECT COUNT(*) AS count FROM Users');
    if (userCount[0].count === 0) {
      await db.execute(`
        INSERT INTO Users (username, email, password_hash, role) VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('daniel', 'daniel@example.com', 'hashed321', 'owner'),
        ('ava456', 'ava456@example.com', 'hashed654', 'walker')
      `);
    }

    // Insert Dogs (if not exists)
    const [dogCount] = await db.execute('SELECT COUNT(*) AS count FROM Dogs');
    if (dogCount[0].count === 0) {
      await db.execute(`
        INSERT INTO Dogs (owner_id, name, size)
        SELECT user_id, 'Max', 'medium' FROM Users WHERE username = 'alice123'
        UNION ALL
        SELECT user_id, 'Bella', 'small' FROM Users WHERE username = 'carol123'
        UNION ALL
        SELECT user_id, 'Charlie', 'large' FROM Users WHERE username = 'daniel'
        UNION ALL
        SELECT user_id, 'Emma', 'medium' FROM Users WHERE username = 'alice123'
        UNION ALL
        SELECT user_id, 'Ethan', 'small' FROM Users WHERE username = 'daniel'
      `);
    }

    // Insert WalkRequests
    const [reqCount] = await db.execute('SELECT COUNT(*) AS count FROM WalkRequests');
    if (reqCount[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT d.dog_id, '2025-06-10 08:00:00', 30, 'Parklands', 'open'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE u.username = 'alice123' AND d.name = 'Max'
        UNION ALL
        SELECT d.dog_id, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE u.username = 'carol123' AND d.name = 'Bella'
        UNION ALL
        SELECT d.dog_id, '2025-06-11 10:00:00', 60, 'Downtown', 'completed'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE u.username = 'daniel' AND d.name = 'Charlie'
        UNION ALL
        SELECT d.dog_id, '2025-06-12 14:00:00', 45, 'Uptown Park', 'open'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE u.username = 'alice123' AND d.name = 'Emma'
        UNION ALL
        SELECT d.dog_id, '2025-06-13 16:30:00', 30, 'Riverside Trail', 'open'
        FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
        WHERE u.username = 'daniel' AND d.name = 'Ethan'
      `);
    }

    // Insert WalkApplications
    const [appCount] = await db.execute('SELECT COUNT(*) AS count FROM WalkApplications');
    if (appCount[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkApplications (request_id, walker_id, applied_at, status)
        VALUES
        (
          (SELECT r.request_id FROM WalkRequests r JOIN Dogs d ON r.dog_id = d.dog_id JOIN Users u ON d.owner_id = u.user_id WHERE u.username = 'alice123' AND d.name = 'Max'),
          (SELECT user_id FROM Users WHERE username = 'bobwalker'),
          '2025-06-08 12:00:00',
          'pending'
        ),
        (
          (SELECT r.request_id FROM WalkRequests r JOIN Dogs d ON r.dog_id = d.dog_id JOIN Users u ON d.owner_id = u.user_id WHERE u.username = 'alice123' AND d.name = 'Max'),
          (SELECT user_id FROM Users WHERE username = 'ava456'),
          '2025-06-09 09:30:00',
          'pending'
        ),
        (
          (SELECT r.request_id FROM WalkRequests r JOIN Dogs d ON r.dog_id = d.dog_id JOIN Users u ON d.owner_id = u.user_id WHERE u.username = 'carol123' AND d.name = 'Bella'),
          (SELECT user_id FROM Users WHERE username = 'bobwalker'),
          '2025-06-08 14:20:00',
          'accepted'
        ),
        (
          (SELECT r.request_id FROM WalkRequests r JOIN Dogs d ON r.dog_id = d.dog_id JOIN Users u ON d.owner_id = u.user_id WHERE u.username = 'daniel' AND d.name = 'Charlie'),
          (SELECT user_id FROM Users WHERE username = 'ava456'),
          '2025-06-09 11:15:00',
          'accepted'
        ),
        (
          (SELECT r.request_id FROM WalkRequests r JOIN Dogs d ON r.dog_id = d.dog_id JOIN Users u ON d.owner_id = u.user_id WHERE u.username = 'alice123' AND d.name = 'Emma'),
          (SELECT user_id FROM Users WHERE username = 'bobwalker'),
          '2025-06-11 10:00:00',
          'rejected'
        )
      `);
    }

    // Insert WalkRatings
    const [rateCount] = await db.execute('SELECT COUNT(*) AS count FROM WalkRatings');
    if (rateCount[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments)
        VALUES
        (
          (SELECT r.request_id FROM WalkRequests r JOIN Dogs d ON r.dog_id = d.dog_id JOIN Users u ON d.owner_id = u.user_id WHERE u.username = 'carol123' AND d.name = 'Bella'),
          (SELECT user_id FROM Users WHERE username = 'bobwalker'),
          (SELECT user_id FROM Users WHERE username = 'carol123'),
          5,
          'Bob was very professional, and Bella had a great time!'
        ),
        (
          (SELECT r.request_id FROM WalkRequests r JOIN Dogs d ON r.dog_id = d.dog_id JOIN Users u ON d.owner_id = u.user_id WHERE u.username = 'daniel' AND d.name = 'Charlie'),
          (SELECT user_id FROM Users WHERE username = 'ava456'),
          (SELECT user_id FROM Users WHERE username = 'daniel'),
          4,
          'Ava did well, but Charlie was a bit nervous; maybe play with him more next time.'
        )
      `);
    }

    console.log('DogWalkService database initialized successfully.');
  } catch (err) {
    console.error('Error setting up database:', err);
  }
})();

// Middleware to attach db to request
app.use((req, res, next) => {
  req.db = db;
  next();
});


// Set routers
app.use('/api/walkers', walkersRouter);
app.use('/api/dogs', dogsRouter);
app.use('/api/walkrequests', walkRequestsRouter);

app.use(express.static(path.join(__dirname, 'public')));

module.exports = app;