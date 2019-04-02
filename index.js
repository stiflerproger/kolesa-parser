'use strict'

const request = require('request');

const $ = require('cheerio');

const LINKS = [
    "https://kolesa.kz/cars/volkswagen/almaty/?price[to]=600000&_sys-hasphoto=2",
    "https://kolesa.kz/cars/mercedes-benz/almaty/?_sys-hasphoto=2&price[to]=600%20000",
    "https://kolesa.kz/cars/toyota/almaty/?_sys-hasphoto=2&price[to]=600%20000",
    "https://kolesa.kz/cars/bmw/almaty/?_sys-hasphoto=2&price[to]=600%20000",
    "https://kolesa.kz/cars/subaru/impreza/almaty/?_sys-hasphoto=2&price[to]=600%20000"
];

const config = require('./config.json');

const mysql_module = require('mysql');

const mysql = require('./lib/mysql')(config.mysql);

const TelegramBot = require('node-telegram-bot-api');

const token = '767825170:AAGJ2QP1Myo9fgt_GvJFpu85X-xUnTYTMX8';

const bot = new TelegramBot(token, {polling : true});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log('Сообщение в чате: ', chatId);
});

parseLinks();
async function parseLinks() {

    console.log(logDate(), 'Инициирую сканирование..');

    for (let i = 0; i < LINKS.length; i++) {

        try {

            let database_cars = await mysql.getCars();

            let kolesa_cars = await parseLink(LINKS[i]);

            // сравнить результаты и обработать
            let to_telegram = await processResult(database_cars, kolesa_cars);

            if (to_telegram.length) {

                for (let message of to_telegram) {
                    message = formatMessage(message);

                    bot.sendMessage(523175098, message);
                    bot.sendMessage(735218038, message);
                }
            }

            // просто ждем 5 секунд прежде чем парсить другой фильтр
            await timeout(5000);

        } catch (e) {
            console.error(logDate(), e);
        }

    }

    console.log(logDate(), 'Сканирование завершено..');

    setTimeout(parseLinks, 10 * 60 * 1000);

}

function parseLink(options, page = 1, cars = []) {

    return new Promise((resolve, reject) => {

        request(options + '&page=' + page,
            function (err, res, body) {
                if (err) return reject( formatError(err, 'REQUEST_ERROR') );


                // объекты машин хранятся в тэгах скриптов
                $(body).find('#results script[type="text/javascript"]').each(function() {
                    let car_obj = $(this).html();

                    // скрипт машины
                    let match = car_obj.match(/listing\.items\.push\((.+)\);/);

                    if (match) {
                        try {

                            car_obj = JSON.parse(match[1]);

                            cars.push(car_obj);

                        } catch (err) {
                            console.error(err);
                        }
                    }

                });

                let more = false;

                if ( $(body).find('.pager .pag-next-page small.gray').length ) {
                    more = true;
                }

                return resolve({
                    more : more,
                    cars : cars
                });
            }
        );

    }).then(result => {

        if (result.more) {
            return parseLink(options, ++page, result.cars);
        }

        // все страницы проверены
        return result.cars;

    }).catch(err => {

        throw err;

    });
}

// сравнить результаты и обработать
function processResult(database_cars, kolesa_cars) {

    let to_message = []; // массив с сообщениями

    return new Promise(async (resolve, reject) => {

        for (let i = 0; i < kolesa_cars.length; i++) {

            try {

                let db_car = database_cars.find(e => e.kolesa_id == kolesa_cars[i].id);

                let car_obj = {
                    kolesa_id : kolesa_cars[i].id,
                    name : kolesa_cars[i].name,
                    price : kolesa_cars[i].unitPrice,
                    avg_price : kolesa_cars[i].attributes.avgPrice ? kolesa_cars[i].attributes.avgPrice : kolesa_cars[i].unitPrice,
                    photo_count : kolesa_cars[i].photoCount,
                    comments_count : kolesa_cars[i].commentsCount,
                    is_credit : kolesa_cars[i].isCreditAvailable ? 1 : 0,
                    created_at : mysql_module.raw('FROM_UNIXTIME (' + Math.floor(new Date(kolesa_cars[i].publicationDate).getTime() / 1000) + ')'),
                    updated_at : mysql_module.raw('FROM_UNIXTIME (' + Math.floor(new Date(kolesa_cars[i].lastUpdate).getTime() / 1000) + ')')
                };

                if (!db_car) {

                    await mysql.addCar(car_obj);

                    // добавляем машину к сообщению
                    to_message.push(Object.assign(car_obj, { type : 'new' }));

                } else {
                    // такая машина уже есть в БД, сверить данные

                    car_obj.changes = []; // список изменений, если они будут

                    if ( Math.floor(new Date(kolesa_cars[i].lastUpdate).getTime() / 1000) != db_car.updated_at ) {
                        // что-то поменялось
                        //car_obj.type = 'changed';
                        //car_obj.changes.push('В объявлении что-то изменилось');
                    }

                    if (car_obj.name !== db_car.name) {
                        car_obj.type = 'changed';
                        car_obj.changes.push('Поменялось название | Было: ' + db_car.name + ' | Стало: ' + car_obj.name);
                    }

                    if (car_obj.price !== db_car.price) {
                        car_obj.type = 'changed';
                        car_obj.changes.push('Поменялась цена | Была: ' + db_car.price + 'тг. | Стала: ' + car_obj.price + 'тг.');
                    }

                    if (car_obj.type && car_obj.type == 'changed') {

                        await mysql.updateCar(car_obj.kolesa_id, {
                            name : car_obj.name,
                            price : car_obj.price,
                            updated_at : car_obj.updated_at
                        });

                        to_message.push(car_obj);
                    }
                }

            } catch (e) {
                console.error(e);
            }

        }

        return resolve();

    }).then(() => {

        return to_message;

    }).catch(err => {

        return formatError(err);

    });

}

function formatMessage(message) {

    if (message.type == 'new') {
        return `❗ Новое объявление\n${message.name} ${message.price}тг. ${message.avg_price !== message.price ? '[средняя: '+message.avg_price+'тг.]' : ''}\nhttps://kolesa.kz/a/show/${message.kolesa_id}`;
    } else if (message.type == 'changed') {
        let msg = '📝 Объявление изменено \n'

        for (let i = 0; i < message.changes.length; i++) {
            msg += '✏' + message.changes[i] + '\n';
        }

        msg += `https://kolesa.kz/a/show/${message.kolesa_id}`;

        return msg;
    }

}

function formatError(err, code) {
    if (typeof err === 'string') {
        err = new Error(err);
    }

    if (typeof code === 'string') {
        err.code = code;
    }

    return err;
}

function timeout(time) {
    return new Promise(resolve => { setTimeout(function() {return resolve();}, time) });
}

function logDate() { return '[' + (new Date()).toLocaleTimeString() + ']'; }
