'use strict'

module.exports = {

    up: async function (client) {
        await client.query(
            'CREATE TABLE IF NOT EXISTS `cars` (' +
                '`kolesa_id` INT NOT NULL, ' +
                '`name` VARCHAR(255) NOT NULL, ' +
                '`price` INT NOT NULL, ' +
                '`avg_price` INT NOT NULL, ' +
                '`photo_count` INT NOT NULL, ' +
                '`comments_count` INT NOT NULL, ' +
                '`is_credit` TINYINT(1) NOT NULL DEFAULT \'0\', ' +
                '`created_at` TIMESTAMP NOT NULL, ' +
                '`updated_at` TIMESTAMP NOT NULL, ' +
                'UNIQUE `kolesa_id` (`kolesa_id`) ' +
            ') '
        , function (err) {
            if (err) console.error(err);
        });
    },

    down : async function (client) {
        await client.query('DROP TABLE IF EXIST `cars`');
    }

};