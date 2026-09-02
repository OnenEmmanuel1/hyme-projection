DROP TABLE IF EXISTS CommandLog;
DROP TABLE IF EXISTS Administrator;
DROP TABLE IF EXISTS Hymn;

CREATE TABLE Hymn (
    HymnID INT AUTO_INCREMENT PRIMARY KEY,
    HymnNumber INT UNIQUE NOT NULL,
    Title VARCHAR(100) NOT NULL,
    Lyrics TEXT NOT NULL,
    VersesJSON JSON,
    Category VARCHAR(30)
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
    FOREIGN KEY (MatchedHymnID) REFERENCES Hymn(HymnID)
);

CREATE INDEX idx_hymn_number ON Hymn(HymnNumber);
CREATE INDEX idx_hymn_title ON Hymn(Title);

-- Seed Administrator: username 'user', password 'password123'
-- Hash generated via bcrypt
INSERT INTO Administrator (Username, PasswordHash) VALUES ('user', '$2b$10$s1ydfro5oFUhw6nAZZrEU.nb9oLQcB7o8s846y3YUu31C2TkyhhP2');

-- Seed Demo Hymns
INSERT INTO Hymn (HymnNumber, Title, Lyrics, Category) VALUES
(245, 'Amazing Grace', 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.', 'Worship'),
(100, 'Holy, Holy, Holy', 'Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to thee.\nHoly, holy, holy! Merciful and mighty,\nGod in three persons, blessed Trinity!', 'Adoration'),
(34, 'How Great Thou Art', 'O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made;\nI see the stars, I hear the rolling thunder,\nThy power throughout the universe displayed.', 'Praise'),
(405, 'It Is Well With My Soul', 'When peace like a river, attendeth my way,\nWhen sorrows like sea billows roll;\nWhatever my lot, Thou hast taught me to say,\nIt is well, it is well, with my soul.', 'Comfort');
