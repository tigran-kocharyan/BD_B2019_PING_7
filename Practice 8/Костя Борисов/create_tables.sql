CREATE TABLE if not exists Publisher(
  PubName TEXT primary key,
  PubAdress TEXT
);

CREATE TABLE if not exists Reader(
  ID SERIAL primary key,
  LastName TEXT,
  FirstName TEXT,
  Address TEXT,
  BirthDate DATE
);

CREATE TABLE if not exists Book(
  ISBN VARCHAR(17) primary key,
  Title TEXT,
  Author TEXT,
  Pages INTEGER,
  PubYear INTEGER,
  PubName TEXT references Publisher(PubName)
);

CREATE TABLE if not exists Category(
  CategoryName TEXT primary key,
  ParentCat TEXT references Category(CategoryName)
);

CREATE TABLE if not exists Copy(
  ISBN VARCHAR(17) references Book(ISBN),
  CopyNumber SERIAL,
  ShelfPosition INTEGER,
  primary key(ISBN, CopyNumber)
);

CREATE TABLE if not exists Borrowing(
  ReaderNr INTEGER references Reader(ID),
  ISBN VARCHAR(17),
  CopyNumber INTEGER,
  ReturnDate DATE,
  primary key(ReaderNr, ISBN, CopyNumber),
  foreign key(ISBN, CopyNumber) references Copy(ISBN, CopyNumber) on update CASCADE
);

CREATE TABLE if not exists BookCat(
  ISBN VARCHAR(17) references Book(ISBN) on update CASCADE on delete CASCADE,
  CategoryName TEXT references Category(CategoryName),
  primary key(ISBN, CategoryName)
);
