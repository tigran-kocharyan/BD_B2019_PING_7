#!/usr/bin/env node

const fs = require('fs');
const express = require("express");
const {Client} = require('pg');
const faker = require('faker');
const port = 12280;

function objectToLower(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
  );
}

function curd(sql, query, prams = null, singular = false) {
  if(!query.toLowerCase().startsWith("select")) {
    query += " RETURNING *";
  }

  return async (req, res) => {
    var data = objectToLower(Object.assign({}, req.query, req.body, req.params));
    try {
      var qr = await sql.query(query, prams?.map(e => data[e]));

      if(qr.rows.length == 0) {
        res.sendStatus(404);
      } else if(qr.rows.length == 1 && singular) {
        res.json(qr.rows[0]);
      } else if(singular) {
        res.sendStatus(500);
      } else {
        res.json(qr.rows);
      }
    } catch(e) {
      console.log(e);
      res.json({"detail": e.detail, "err": true});
      res.status(406);
    }
  };
}

function listen(sql) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({extended: true}));

  app.get("/", async (req, res) => {
    data = Object.assign({}, req.query, req.body);
    res.json({
      message: "Это стартовая страница нашего приложения",
      "в твоём запросе": data
    });
  });

  app.get("/readers", curd(sql, "select * from Reader"));
  app.get("/readers/:id", curd(sql, "select * from Reader WHERE id = $1", ['id'], true));
  app.delete("/readers", curd(sql, "DELETE from Reader"));
  app.delete("/readers/:id", curd(sql, "DELETE from Reader WHERE id = $1", ['id'], true));

  app.get("/books", curd(sql, "select * from Book"));
  app.get("/books/:isbn", curd(sql, "select * from Book WHERE isbn = $1", ['isbn'], true));
  app.delete("/books", curd(sql, "DELETE from Book"));
  app.delete("/books/:isbn", curd(sql, "DELETE from Book WHERE isbn = $1", ['isbn'], true));
  app.post("/books", curd(sql, "insert into Book values($1, $2, $3, $4, $5, $6)", ['isbn', 'title', 'author', 'pages', 'pubyear', 'pubname'], true));

  app.put("/books/:_isbn", curd(sql, `
    UPDATE Book
    SET isbn = $2, title = $3, author = $4, pages = $5, pubyear = $6, pubname = $7
    WHERE isbn = $1
  `, ['_isbn', 'isbn', 'title', 'author', 'pages', 'pubyear', 'pubname'], true));

  app.get("/copies", curd(sql, "select * from Copy"));
  app.get("/copies/:isbn", curd(sql, "select * from Copy WHERE isbn = $1", ['isbn']));
  app.get("/copies/:isbn/:num", curd(sql, "select * from Copy WHERE isbn = $1 AND copynumber = $2", ['isbn', 'num'], true));
  app.delete("/copies", curd(sql, "DELETE from Copy"));
  app.delete("/copies/:isbn", curd(sql, "DELETE from Copy WHERE isbn = $1", ['isbn']));
  app.delete("/copies/:isbn/:num", curd(sql, "DELETE from Copy WHERE isbn = $1 AND copynumber = $2", ['isbn', 'num'], true));
  app.post("/copies", curd(sql, "insert into Copy values($1, $2, $3)", ['isbn', 'copynumber', 'shelfposition'], true));

  app.put("/copies/:_isbn/:_num", curd(sql, `
    UPDATE Copy
    SET isbn = $3, copynumber = $4, shelfposition = $5
    WHERE isbn = $1 AND copynumber = $2
  `, ['_isbn', '_num', 'isbn', 'copynumber', 'shelfposition'], true));

  app.get("/borrowings", curd(sql, "select * from Borrowing"));
  app.get("/borrowings/by_reader/:id", curd(sql, "select * from Borrowing WHERE ReaderNr = $1", ['id']));
  app.get("/borrowings/by_book/:isbn", curd(sql, "select * from Borrowing WHERE isbn = $1", ['isbn']));
  app.get("/borrowings/by_book/:isbn/:num", curd(sql, "select * from Borrowing WHERE isbn = $1 AND copynumber = $2", ['isbn', 'num']));
  app.delete("/borrowings/by_reader/:id", curd(sql, "DELETE from Borrowing WHERE ReaderNr = $1", ['id']));
  app.delete("/borrowings/by_book/:isbn", curd(sql, "DELETE from Borrowing WHERE isbn = $1", ['isbn']));
  app.delete("/borrowings/by_book/:isbn/:num", curd(sql, "DELETE from Borrowing WHERE isbn = $1 AND copynumber = $2", ['isbn', 'num']));
  app.post("/borrowings", curd(sql, "insert into Borrowing values($1, $2, $3, $4)", ['readernr', 'isbn', 'copynumber', 'returndate'], true));

  app.listen(port, () => {
    console.log(`Сервер запущен на ${port} порту`);
  });
}

function fakeAddress() {
  return [
    faker.address.streetAddress(),
    faker.address.secondaryAddress(),
    faker.address.city(),
    faker.address.state(),
    faker.address.country(),
  ].join(', ');
}

function fakeIsbn() {
  return faker.helpers.replaceSymbolWithNumber('###-#-##-######-#');
}

function range(n, map) {
  return Promise.all(Array(faker.datatype.number(n)).fill().map(map).map(p => p.catch(e => e)));
}

async function generate(sql) {
  await range(100, () => (
    sql.query("insert into Reader(LastName, FirstName, Address, BirthDate) values($1, $2, $3, $4)", [
      faker.name.lastName(),
      faker.name.firstName(),
      fakeAddress(),
      faker.date.past(80, new Date("2000-01-01")),
    ])
  ));

  await range(10, () => (
    sql.query("insert into Publisher values($1, $2)", [
      faker.company.catchPhraseNoun(),
      fakeAddress(),
    ])
  ));

  await range(5, () => (
    sql.query("insert into Category values($1, NULL)", [
      faker.company.bsBuzz(),
    ])
  ));

  var categories = (await sql.query("select categoryname from Category")).rows.map(e => e.categoryname);
  await range(5, () => (
    sql.query("insert into Category values($1, $2)", [
      faker.commerce.productAdjective(),
      faker.random.arrayElement(categories),
    ])
  ));
  categories = (await sql.query("select categoryname from Category")).rows.map(e => e.categoryname);

  var readers = (await sql.query("select id from Reader")).rows.map(e => e.id);
  var publishers = (await sql.query("select pubname from Publisher")).rows.map(e => e.pubname);

  await range(100, () => (
    sql.query("insert into Book values($1, $2, $3, $4, $5, $6)", [
      fakeIsbn(),
      faker.commerce.productName(),
      faker.name.findName(),
      faker.datatype.number({min: 100, max: 1000}),
      faker.datatype.number({min: 1800, max: 2020}),
      faker.random.arrayElement(publishers),
    ])
  ));

  var books = (await sql.query("select isbn from Book")).rows.map(e => e.isbn);
  await range(100, () => (
    sql.query("insert into Copy values($1, $3, $2)", [
      faker.random.arrayElement(books),
      faker.datatype.number(5),
      faker.datatype.number(20),
    ])
  ));

  var copies = (await sql.query("select isbn,copynumber from Copy")).rows.map(e => [e.isbn, e.copynumber]);
  await range(100, () => (
    sql.query("insert into Borrowing values($1, $2, $3, $4)", [
      faker.random.arrayElement(readers),
      ...faker.random.arrayElement(copies),
      faker.datatype.boolean() ? faker.date.soon(30) : faker.date.recent(30),
    ])
  ));

  await range(100, () => (
    sql.query("insert into BookCat values($1, $2)", [
      faker.random.arrayElement(books),
      faker.random.arrayElement(categories),
    ])
  ));
}

async function main() {
  const client = new Client(process.env.SQL_URL || null);
  await client.connect();
  client.query(fs.readFileSync('create_tables.sql', 'utf8'));

  if(process.argv.includes('generate')) {
    await generate(client);
  }

  if(process.argv.includes('listen')) {
    listen(client);
    return;
  }

  process.exit(0);
}

main();
