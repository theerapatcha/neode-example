/**
 * A basic example using Express to create a simple movie recommendation engine.
 */
const express = require('express');
const session = require('express-session');
const path = require('path');

/**
 * Load Neode with the variables stored in `.env` and tell neode to
 * look for models in the ./models directory.
 */
const neode = require('neode')
    .fromEnv()
    .withDirectory(path.join(__dirname, 'models'));

/**
 * Create a new Express instance
 */
const app = express();
app.use(express.json());

/**
 * Tell express to use jade as the view engine and to look for views
 * inside the ./views folder
 */
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, '/views'));

/**
 * SCRF for AJAX requests used in /recommend/:genre
 */
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

/**
 * Set up a simple Session
 */
app.use(session({
    genid: function () {
        return require('uuid').v4();
    },
    resave: false,
    saveUninitialized: true,
    secret: 'neoderocks'
}));

/**
 * Serve anything inside the ./public folder as a static resource
 */
app.use(express.static('public'));



/**
 * Display home page with a list of Genres
 */
app.get('/', (req, res) => {
    neode.all('Person')
        .then(persons => {
            res.render('index', { title: 'Home', persons });
        });
});


/**
 * Provided a map of results in the query string, create a set of rated relationships
 * and then run a query to recommend a film.
 *
 * In reality, you'd be better off installing bodyparser and taking this ingesting
 * as a post body.
 */
app.get('/persons/:pid', (req, res) => {
    const query = `
        MATCH (p:Person)-[r:CONTACTED]-(s:Person) WHERE ID(p) = {pid}
        RETURN p, r, s
    `;

    const params = {
        pid: parseInt(req.params.pid),
    };

    neode.cypher(query, params)
        .then(results =>
            Promise.all([
                neode.hydrateFirst(results, 'p'),
                results.records.map(x => x.get('r')),
                neode.hydrate(results, 's')]))
        .then(([person, relations, dests]) => {
            console.log(relations, dests)
            res.render('person', {
                title: "Person: " + person.get("name"),
                person,
                relations,
                dests
            });
        })
        .catch(e => {
            console.log(e)
            res.status(500).send(e.getMessage());
        });
});

/**
 * For examples of how to use Neode to quickly generate a REST API,
 * checkout the route examples in ./routes.api.js
 */
app.use(require('./routes/api')(neode));

/**
 * Listen for requests on port 3000
 */
app.listen(3000, function () {
    console.log('app listening on http://localhost:3000'); // eslint-disable-line no-console
});
