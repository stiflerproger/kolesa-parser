'use strict'

const MIGRATIONS = {
    cars : require('./lib/migrations/cars.js')
}

const config = require('./config.json');

const mysql = require('mysql');

const client = mysql.createPool(
    Object.assign(config.mysql, {
        connectionLimit : 10
    })
);

(async () => {

    for (let migration in MIGRATIONS) {
        await MIGRATIONS[migration].up(client);
    }

})()