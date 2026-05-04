// utils/scheduleHelpers.js

const isOvernight = (startTime, endTime) => {
    return startTime > endTime;
};


const getScheduleDaysForCheck = (schedule) => {
    const dayOrder = [
        "sunday", "monday", "tuesday", "wednesday",
        "thursday", "friday", "saturday"
    ];

    if (!isOvernight(schedule.startTime, schedule.endTime)) {
        return [...schedule.days]; // return a copy
    }

    // Overnight schedule → include next day as well
    const extendedDays = new Set(schedule.days);

    schedule.days.forEach(d => {
        const idx = dayOrder.indexOf(d.toLowerCase().trim());
        if (idx !== -1) {
            const nextDay = dayOrder[(idx + 1) % 7];
            extendedDays.add(nextDay);
        }
    });

    return Array.from(extendedDays);
};

module.exports = {
    isOvernight,
    getScheduleDaysForCheck
};