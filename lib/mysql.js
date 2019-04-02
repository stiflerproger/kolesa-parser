'use strict'

const mysql = require('mysql');

const AVAILABLE_CAR_UPDATE = ["name", "price", "avg_price", "photo_count", "comments_count", "is_credit", "updated_at"];

function MySQL(options) {
    if(!(this instanceof MySQL)) return new MySQL(options);

    options = validateOptions(options);

    let self = this;

    // создаем экземпляр клиента
    self.client = mysql.createPool(options);

    // игнорируем ошибки клиента
    self.client.on('error', () => {});
}

/**
 * Возвращат массив с машинами что в БД
 */
MySQL.prototype.getCars = function (attempts, interval) {
    if (typeof attempts !== 'number') {
        attempts = 0;
    }

    if (typeof interval !== 'number') {
        interval = 0;
    }

    let self = this;

    return new Promise((resolve, reject) => {

        self.client.query({
            sql : "SELECT `kolesa_id`, `name`, `price`, `avg_price`, `photo_count`, `comments_count`, `is_credit`, UNIX_TIMESTAMP (`created_at`) as `created_at`, UNIX_TIMESTAMP (`updated_at`) as `updated_at` FROM `cars`",
            timeout: 30000
        }, function (error, rows, fields) {
            if (error) return reject(self.packErrMsg(error, 'MYSQL_REQUEST_ERROR'));

            return resolve(rows);
        });

    })
    .then(rows => {
        return rows;
    })
    .catch(error => {

        if (attempts) {

            return setTimeout(function() {
                self.getCars(--attempts, interval);
            }, interval);

        } else {

            throw self.packErrMsg(error);

        }

    });
}

/**
 * Добавляет поинты активности пользователю в ротации
 */
MySQL.prototype.addCar = function (car, attempts, interval) {
    if (typeof attempts !== 'number') {
        attempts = 0;
    }

    if (typeof interval !== 'number') {
        interval = 0;
    }

    let self = this;

    return new Promise((resolve, reject) => {

        self.client.query({
            sql : "INSERT INTO `cars` SET ?",
            values : [ car ],
            timeout: 30000
        }, function (error, rows, fields) {
            if (error) return reject(self.packErrMsg(error, 'MYSQL_REQUEST_ERROR'));

            return resolve();
        });

    })
    .then(() => {
        return true;
    })
    .catch(error => {

        if (attempts) {

            return setTimeout(function() {
                self.updateRotation(rotation_id, update_data, connection, --attempts, interval);
            }, interval);

        } else {

            throw self.packErrMsg(error);

        }

    });
}


MySQL.prototype.updateCar = function (kolesa_id, update_data, attempts, interval) {
    if (typeof attempts !== 'number') {
        attempts = 0;
    }

    if (typeof interval !== 'number') {
        interval = 0;
    }

    let self = this;

    if (Object(update_data) !== update_data) {
        throw self.packErrMsg('update_data must be an object', 'INCORRECT_DATA');
    }

    for (let update_key in update_data) {
        if (AVAILABLE_CAR_UPDATE.indexOf(update_key) == -1) {
            throw self.packErrMsg('Not found key: ' + update_key + ' in available cars updates', 'INCORRECT_DATA');
        }
    }

    return new Promise((resolve, reject) => {

        self.client.query({
            sql : "UPDATE `cars` SET ? WHERE `kolesa_id` = ?",
            values : [ update_data, kolesa_id ],
            timeout: 30000
        }, function (error, rows, fields) {
            if (error) return reject(self.packErrMsg(error, 'MYSQL_REQUEST_ERROR'));

            return resolve();
        });

    })
    .then(() => {
        return true;
    })
    .catch(error => {

        if (attempts) {

            return setTimeout(function() {
                self.updateCar(kolesa_id, update_data, --attempts, interval);
            }, interval);

        } else {

            throw self.packErrMsg(error);

        }

    });
}

MySQL.prototype.packErrMsg = function (err, code) {
    if (typeof err === 'string') {
        err = new Error(err);
    }

    if (typeof code === 'string') {
        err.code = code;
    }

    return err;
};

module.exports = MySQL;

function validateOptions(options) {
    if (Object(options) !== options) {
        throw new Error('Requires options to be set');
    }

    // все поля с типами данных BIGINT и DECIMAL будут возвращены в виде строк
    options.supportBigNumbers = true;
    options.bigNumberStrings = true;

    // отключаем подробную трассировку по умолчанию
    if (typeof options.trace === 'undefined') {
        options.trace = false;
    }

    if (typeof options.connectionLimit === 'undefined') {
        options.connectionLimit = 10;
    }

    return options;
}