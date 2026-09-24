DROP TABLE IF EXISTS CommandLog;
DROP TABLE IF EXISTS Administrator;
DROP TABLE IF EXISTS hymn_stanzas;
DROP TABLE IF EXISTS hymns;
DROP TABLE IF EXISTS Hymn;

CREATE TABLE hymns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hymn_number INT UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL
);

CREATE TABLE hymn_stanzas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hymn_id INT NOT NULL,
    stanza_number INT NOT NULL,
    is_chorus BOOLEAN DEFAULT FALSE,
    content TEXT NOT NULL,
    FOREIGN KEY (hymn_id) REFERENCES hymns(id) ON DELETE CASCADE
);

CREATE TABLE Administrator (
    AdminID INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(20) UNIQUE NOT NULL,
    PasswordHash VARCHAR(255) NOT NULL
);

CREATE TABLE CommandLog (
    LogID INT AUTO_INCREMENT PRIMARY KEY,
    RecognisedText VARCHAR(255) NOT NULL,
    MatchedHymnID INT,
    Status ENUM('Matched', 'Not Found') NOT NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MatchedHymnID) REFERENCES hymns(id) ON DELETE SET NULL
);

CREATE INDEX idx_hymn_number ON hymns(hymn_number);
CREATE INDEX idx_hymn_title ON hymns(title);

-- Seed Administrator: username 'user', password 'password123'
INSERT INTO Administrator (Username, PasswordHash) VALUES ('user', '$2b$10$s1ydfro5oFUhw6nAZZrEU.nb9oLQcB7o8s846y3YUu31C2TkyhhP2');

-- Seed Demo Hymns
INSERT INTO hymns (id, hymn_number, title) VALUES
(1, 125, 'Amazing Grace'),
(2, 42, 'Holy, Holy, Holy');

INSERT INTO hymn_stanzas (id, hymn_id, stanza_number, is_chorus, content) VALUES
(101, 1, 1, FALSE, 'Amazing grace! how sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.'),
(102, 1, 2, FALSE, '’Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!'),
(103, 2, 1, FALSE, 'Holy, Holy, Holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;');
