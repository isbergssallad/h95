const express = require("express");
var hbs = require('hbs');
const mysql = require("mysql2");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);


const app = express();
app.set('view engine', 'hbs')
dotenv.config({ path: "./.env" });
hbs.registerPartials(__dirname + '/views/partials', function (err) { });

// Anslutning till databas med environment variabler
const options = {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
};

// Skapar en anslutning till databasen
// multipleStatements: true för att kunna köra flera queries
// namedPlaceholders: true för att kunna referera till samma placeholder flera gånger
const db = mysql.createConnection({ ...options, multipleStatements: true, namedPlaceholders: true });


const sessionStore = new MySQLStore(options);


// Används för att lagra sessioner
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: true,
        store: sessionStore,
        saveUninitialized: true,
    })
);

// Anslutning till databasen
db.connect((error) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Connected to MySQL");
    }
});

// Använd static files
app.use(express.static(path.join(__dirname, "/public/")));


// Använd bodyparser
app.use(express.urlencoded({ extended: 'false' }));
app.use(express.json());


// Index, skicka med currentUser
app.get("/", (req, res) => {
    res.render("index", { currentUser: req.session });
});


// Login
app.get("/login", (req, res) => {
    // Om det finns en aktiv session
    if (req.session.loggedin) {
        // Redirect till dashboard
        res.redirect("/dashboard");
    } else {
        //Annars rendera login
        res.render("login");
    }
})

// Register
app.get("/register", (req, res) => {
    //Om det finns en aktiv session
    if (req.session.loggedin) {
        res.redirect("/dashboard");
    } else {
        res.render("register");
    }
});


// Alla filmer
app.get("/films", (req, res) => {
    //Rendera alla filmer, skicka med currentUser
    res.render("films", { currentUser: req.session });
});


// Film
app.get("/film", (req, res) => { 
    // Kontrollera om användaren är inloggad
    if (req.session.loggedin) {
        // Databas fråga för att kontrollera om filmen finns i användarens watchlist och om filmen är sedd.
        db.query("SELECT * FROM h95.users_watchlist WHERE userID = ? and filmID = ?", [req.session.userID, req.query.film_id], (err, rows) => {
            //Error hantering
            if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

            // Kontrollera om filmen är planerad / i watchlist
            const planned = rows.filter(row => { return row.status === "planned" }).length > 0;
            // Kontrollera om filmen är sedd
            const watched = rows.filter(row => { return row.status === "watched" }).length > 0;

            // Rendera filmsidan och skicka med information om nuvarande användaren, filmID, samt status för filmen
            res.render("film", { currentUser: req.session, filmID: req.query.film_id, planned, watched });
        });
    } else {
        // Om användaren inte är inloggad, rendera filmsidan utan att information om film status
        res.render("film", { currentUser: req.session, filmID: req.query.film_id });
    }
});


app.get("/watchlist", (req, res) => {
    // Kontrollera om användaren är inloggad
    if (req.session.loggedin) {
        // Databas fråga för att hämta filmer i användaren watchlist
        db.query("SELECT * FROM h95.users_watchlist WHERE userID = ? and status = 'planned'", [req.session.userID], (err, rows) => {
            // Error hantering
            if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

            // Om användare har filmer i watchlist
            if (rows.length > 0) {
                // Databas fråga för att hämta poster och filmID
                db.query("SELECT poster, filmID FROM h95.films WHERE filmID in (?)", [rows.map(row => row.filmID)], (err, result) => {
                    // Error hantering
                    if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

                    //Rendera watchlist och skicka med information om nuvarande användaren och filmerna i watchlist
                    res.render("watchlist", { currentUser: req.session, watchlist: result });
                })
            } else {
                // Om användaren inte har filmer i watchlist, rendera watchlist med en tom lista
                // Detta är för att undvika en error om användaren inte har några filmer i watchlist
                res.render("watchlist", { currentUser: req.session, watchlist: [] });
            }
        })
    } else {
        // Om användaren inte är inloggad, redirect till login
        res.redirect("login");
    }
})


app.get("/dashboard", (req, res) => {
    // Kontrollera om användaren är inloggad
    if (req.session.loggedin) {
        //Hämtar alla filmer nuvarande användaren har sett
        db.query("SELECT * FROM h95.users_watchlist WHERE userID = ? and status = 'watched'", [req.session.userID], (err, rows) => {
            //Error hantering
            if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

            //Rows > 0 innebär att en användare har sett filmer
            if (rows.length > 0) {
                //Hämtar poster och filmID
                db.query("SELECT poster, filmID FROM h95.films WHERE filmID in (?)", [rows.map(row => row.filmID)], (err, result) => {
                    // Error hantering
                    if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

                    // Rendera dashboard och skicka med information om nuvarande användaren och filmerna som användaren har sett
                    res.render("dashboard", { currentUser: req.session, watchlist: result });
                })
            } else {
                // Om användaren inte har sett några filmer, rendera dashboard med en tom lista
                // Detta är för att undvika en error om användaren inte har sett några filmer
                res.render("dashboard", { currentUser: req.session, watchlist: [] });
            }
        })
    } else {
        // Om användaren inte är inloggad, redirect till login
        res.redirect("login");
    }
})


app.get("/terms", (req, res) => {
    // Rendera terms och skicka med currentUser
    res.render("terms", { currentUser: req.session })
});


app.get("/movies", (req, res) => {
    // Query för att hämta alla filmer
    db.query("SELECT * FROM h95.films", (err, results) => {
        // Error hantering
        if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

        // Skicka med alla filmer som JSON
        res.json({ movies: results });
    });
});


// Funktion för att validera lösenord
function ValidatePassword(password) {
    var a = password;
    //Regex-filter, måste vara längre än 8 karaktärer och innehålla stora och små bokstäver
    var filter = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
    if (filter.test(a)) {
        return true;
    }
    else {
        return false;
    }
}


// Skapa användare
app.post("/auth/register", async (req, res) => {
    // Hämta användarnamn, password och password confirm från body
    const { username, password, password_confirm } = req.body;

    //Om lösenord inte matchar med confirm
    if (password !== password_confirm) {
        return res.status(400).send("Passwords do not match");
    }

    // Validera lösenord med funktion
    if (!ValidatePassword(password)) {
        return res.status(400).send("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
    }

    // Hasha lösenord
    const hashedPassword = await bcrypt.hash(password, 10);

    // Databas fråga för att kolla om nuvarande användarnamn redan finns i databasen
    db.query("SELECT * FROM h95.users WHERE username = ?", [username], async (err, results) => {
        // Error hantering
        if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

        // Om användarnamn redan finns
        if (results.length > 0) {
            return res.status(409).send("Username already exists");
        }

        // Databas fråga för att insert användare och hashat lösenord i databasen 
        db.query("INSERT INTO h95.users (username, password) VALUES (?, ?)", [username, hashedPassword], (err) => {
            if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

            //Hämta userID för att kunna sätta session
            db.query("SELECT userID FROM h95.users WHERE username = ?", [username], (err, result) => {
                //Sätt session
                req.session.loggedin = true;
                req.session.username = username;
                req.session.userID = result[0].userID;

                //Redirect till dashboard
                res.redirect("/dashboard");
                console.log("Success", username)

            })
            console.log("New user registered:", username);
        });
    });
});


// Login
app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;

    // Databas fråga för att söka om användarnamn finns
    db.query("SELECT * FROM h95.users WHERE username = ?", [username], async (err, results) => {
        if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

        //Om användarnamn inte finns
        if (results.length == 0) {
            return res.status(401).send("Invalid username or password");
        }
        //Hämta användare
        const user = results[0]
        //Kolla om lösenord matchar
        const passwordMatch = await bcrypt.compare(password, user.password);

        //Om användarnamn och lösenord är rätt
        if (user.username == username && passwordMatch) {
            //Sätt session
            req.session.loggedin = true;
            req.session.username = username;
            req.session.userID = user.userID;
            res.redirect("/dashboard");
            console.log("Success", username)
        }

        //Om lösenord inte stämmer
        if (!passwordMatch) {
            return res.status(401).send("Invalid username or password");
        }
    })

});


// Funktion för att lägga till en film i watchlist
function addToWatchlist(userID, filmID, status, cb) {
    // Databas fråga för att lägga till i watchlist
    db.query("INSERT INTO h95.users_watchlist (userID, filmID, status) VALUES (?, ?, ?)", [userID, filmID, status], (err, result) => {
        if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }
        cb()
    });
}


app.get("/search", (req, res) => {
    // Query för att söka efter filmer
    // Används LOWER för att göra sökningen case-insensitive, 
    // Använd like för att kunna söka efter liknande ord
    db.query("SELECT * FROM h95.films WHERE LOWER(title) LIKE LOWER(?)", ['%' + req.query.q + '%'], (err, result) => {
        if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }
        res.render("search", { currentUser: req.session, searchResults: result, queryString: req.query.q });
    })
})


// Post till watchlist då användare tar bort eller lägger till filmer i watchlist
app.post("/watchlist", (req, res) => {
    // Om användare inte är inloggad, redirect till login
    if (!req.session.loggedin) {
        res.redirect("login");
        return;
    }

    // Om posten är planned 
    if (req.body.status === "planned") {
        // Kolla om användaren har filmen i watchlist
        db.query("SELECT * FROM h95.users_watchlist WHERE userID = ? and filmID = ? and status = 'planned'", [req.session.userID, req.body.filmID], (err, result) => {
            // Error hantering
            if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }

            // Om användaren har filmen i watchlist redan
            if (result.length > 0) {
                // Databas fråga för att ta bort filmen från användarens watchlist
                db.query("DELETE FROM h95.users_watchlist WHERE ID IN (?)", [result.map(row => row.ID)]);

                // Redirect till samma film / refresh
                res.redirect("/film?film_id=" + req.body.filmID);
            } else {
                // Om användaren inte har filmen i watchlist, lägg till filmen i watchlist
                addToWatchlist(req.session.userID, req.body.filmID, req.body.status, () => { res.redirect("/film?film_id=" + req.body.filmID); })
            }
        });
    }
    else {
        // Om posten är watched / filmen är sedd
        addToWatchlist(req.session.userID, req.body.filmID, req.body.status, () => { res.redirect("/film?film_id=" + req.body.filmID); })
    }

})


app.get('/logout', function (req, res, next) {
    // Ta bort session och redirect till startsidan
    req.session.user = null;
    req.session.loggedin = false;
    req.session.save(function (err) {
        if (err) next(err);
        
        // Regenerera session
        req.session.regenerate(function (err) {
            if (err) next(err)
            res.redirect('/');
        })
    })
})


// Get till delete-account, när en användare ska ta bort sitt konto
app.get("/delete-account", (req, res) => {
    //Om det finns en aktiv session
    if (req.session.loggedin) {
        // Rendera delete-account och skicka med currentUser
        res.render("delete-account", { currentUser: req.session });
    } else {
        //Om det inte finns en aktiv session, redirect till login
        res.redirect("login");
    }
})

// Postar till delete, när en användare ska ta bort konto
app.post('/delete', function (req, res) {
    // Databas fråga för att ta bort användare och allt relaterat data
    db.query("DELETE FROM h95.users WHERE userID = :userID; DELETE FROM h95.users_watchlist WHERE userID = :userID", { userID: req.session.userID }, (err) => {
        // Error hantering
        if (err) { res.render("error", { message: 'Something went wrong :/', error: JSON.stringify(err, null, 2) }); return; }
        res.redirect('/logout')
    })

})


app.listen(4000, () => {
    console.log("http://localhost:4000")
})