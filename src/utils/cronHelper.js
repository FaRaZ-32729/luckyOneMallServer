// src/utils/cronHelper.js

const dayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
};

const generateCron = (time, days) => {
    const [hour, minute] = time.split(":");

    const cronDays = days.map(d => {
        const key = d.toLowerCase();
        if (!(key in dayMap)) throw new Error(`Invalid day: ${d}`);
        return dayMap[key];
    }).join(",");

    return `${minute} ${hour} * * ${cronDays}`;
};

module.exports = { generateCron };