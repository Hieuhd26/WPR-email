CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fullName VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT,
  receiver_id INT,
  content TEXT,
  file VARCHAR(255),
  title VARCHAR(255) DEFAULT 'No subject',
  timeReceived TIMESTAMP,
  timeSent TIMESTAMP,
  deleted BOOLEAN DEFAULT 0,
  deleted2 BOOLEAN DEFAULT 0,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);


INSERT INTO users (fullName, email, password) VALUES
  ('Hiệu', 'a@a.com', '1234567'),
  ('Huê', 'b@b.com', '1234567'),
  ('Hoa', 'c@c.com', '1234567');

INSERT INTO messages (sender_id, receiver_id, content, file, title, timeReceived, timeSent) VALUES
  (1, 2, 'User 1 send to User 2', '', 'WPR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (1, 3, 'User 1 send to User 3', '', 'PR1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 1, 'User 2 send to User 1', '', 'PR2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, 1, 'User 3 send to User 1', '', 'DSA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 1, 'User 2 send to User 1 V2', '', 'SAD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, 1, 'User 3 send to User 1 V2', '', 'HCI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 1, 'User 2 send to User 1 V2', '', 'ISD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, 1, 'User 3 send to User 1 V3', '', 'MPR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (1, 3, 'User 1 send to User 3 V2', '', 'DBS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 3, 'User 2 send to User 3', '', 'CAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, 2, 'User 3 send to User 2', '', 'POP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 3, 'User 2 send to User 3', '', 'PCO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (1, 3, 'User 1 send to User 3 v3', '', 'AIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
