/**
 * As this file requires an instance of neode, I've exported
 * a function that when called will return a new express Router.
 *
 * This can be added to express by calling
 *
 * app.use(require('./routes/api')(neode));
 *
 * @param {Neode} neode  Neode instance
 * @return {Router}      Express router
 */
module.exports = function (neode) {
    const router = require('express').Router();
    const moment = require('moment')
    const person = neode.model("Person");
    const range = (start, end, length = end - start) =>
        Array.from({ length }, (_, i) => start + i)
    // list persons
    router.get('/api/persons', (req, res) => {
        const order_by = req.query.order || 'title';
        const sort = req.query.sort || 'ASC';
        const limit = req.query.limit || 10;
        const page = req.query.page || 1;
        const skip = (page - 1) * limit;

        const params = {};
        const order = { [order_by]: sort };

        neode.all('Person', params, order, limit, skip)
            .then(res => {
                /*
                 *`all` returns a NodeCollection - this has a toJson method that
                 * will convert all Nodes within the collection into a JSON object
                 */
                return res.toJson();
            })
            .then(json => {
                res.send(json);
            })
            .catch(e => {
                res.status(500).send(e.stack);
            });
    });

    // get person by id
    router.get('/api/persons/:id', (req, res) => {

    });


    // add person
    router.post('/api/persons', (req, res) => {
        person.mergeOn({
            name: req.body.name
        }).then(p => {
            console.log(`Created person ${p.id()}`)
            res.status(201).send({
                id: p.id(),
                ...p.toJson()
            });
        })
    })

    router.post('/api/persons/:pid1/contact/:pid2', (req, res) => {
        const { pid1, pid2 } = req.params;
        const { contactTime = moment().format() } = req.body;
        Promise
            .all([person.findById(pid1), person.findById(pid2)])
            .then(([p1, p2]) => {
                if (p1 === false) {
                    res.status(404).send({ error: `Person ${pid1} not found` })
                    return
                }
                if (p2 === false) {
                    res.status(404).send({ error: `Person ${pid2} not found` })
                    return
                }
                p1.relateTo(p2, "contacted", { contactTime: contactTime })
                    .then(() => {
                        res.status(200).send();
                    })
            })

    })

    router.post('/api/persons/:pid/infect', (req, res) => {
        const { pid } = req.params;
        const { infectTime = moment().format() } = req.body;
        person.findById(pid).then(p => {
            if (p === false) {
                res.status(404).send({ error: `Person ${pid1} not found` })
                return;
            }
            p.update({ status: "infected", infectTime: infectTime })
            res.status(200).send();
        })
    });

    router.post('/api/persons/:pid/cured', (req, res) => {
        const { pid } = req.params;
        const { curedTime = moment().format() } = req.body;
        person.findById(pid).then(p => {
            if (p === false) {
                res.status(404).send({ error: `Person ${pid1} not found` })
                return;
            }
            p.update({ status: "cured", curedTime: curedTime })
            res.status(200).send();
        })
    });

    router.get('/api/persons/:pid/check-risk', (req, res) => {
        const { pid } = req.params
        const { hop = 2, riskPeriodDays = 14 } = req.query;
        //duration.inDays(date("2012-04-04"), date("2011-04-05")).days
        // *1..2
        const cypher = `
        MATCH paths = (p:Person)-[indirects:CONTACTED *0..${hop - 1}]-(t)-[direct:CONTACTED]-(s:Person)
            WHERE ID(p) = ${pid}
            AND s.status = 'infected' 
            AND duration.inDays(datetime(direct.contactTime), datetime(s.infectTime)).days < ${riskPeriodDays}
            WITH p, indirects, s, direct, paths
            RETURN s as infected, p as me, REDUCE(riskTime = direct.contactTime, f IN indirects | CASE
                WHEN riskTime <> false AND f.contactTime > riskTime AND  duration.inDays(datetime(f.contactTime), datetime(riskTime)).days < ${riskPeriodDays} THEN
                    f.contactTime
                ELSE
                    false
                END
            ) as riskTime, paths;`

        neode.cypher(cypher)
            .then(result => {
                if (result.records.length > 0) {
                    const paths = result.records[0].get('paths').segments
                        .map(({ relationship, end }) => ({
                            src_pid: relationship.start + '',
                            contact_time: relationship.properties['contactTime'],
                            dest_pid: relationship.end + '',
                            dest_status: end.properties['status']
                        }))
                    res.status(200).send({
                        infected: neode.hydrateFirst(result, 'infected').name,
                        paths: paths,
                        is_risk: result.records[0].get('riskTime') != false
                    })
                } else {
                    res.status(200).send("NOT RISK")
                }


            });
    })

    return router;
};