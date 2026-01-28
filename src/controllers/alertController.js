const deviceModel = require("../models/deviceModel");
const venueModel = require("../models/venueModal");

// Returns alerts for all venues under an organization
const getAlerts = async (req, res) => {
    try {
        const { organizationId } = req.params;

        // Get all venues under this organization
        const venues = await venueModel.find({ organization: organizationId }).lean();
        if (!venues.length) return res.status(404).json({ message: "No venues found" });

        const venueIds = venues.map((v) => v._id);

        // Get all devices inside those venues
        const devices = await deviceModel.find({ venue: { $in: venueIds } })
            .populate("venue", "name")
            .lean();

        // Aggregate alerts per venue
        const result = venues.map((venue) => {
            const venueDevices = devices.filter(
                (d) => d.venue._id.toString() === venue._id.toString()
            );

            // Devices with any alerts
            const devicesWithAlerts = venueDevices.filter(
                (d) =>
                    d.temperatureAlert ||
                    d.humidityAlert ||
                    d.odourAlert ||
                    d.aqiAlert ||
                    d.glAlert
            );

            // Temperature alerts
            const temperatureAlerts = venueDevices
                .filter((d) => d.temperatureAlert)
                .map((d) => ({
                    deviceId: d.deviceId,
                    temperature: d.espTemprature,
                    humidity: d.espHumidity
                }));

            // Humidity alerts
            const humidityAlerts = venueDevices
                .filter((d) => d.humidityAlert)
                .map((d) => ({
                    deviceId: d.deviceId,
                    temperature: d.espTemprature,
                    humidity: d.espHumidity
                }));

            // Odour alerts
            const odourAlerts = venueDevices
                .filter((d) => d.odourAlert)
                .map((d) => ({
                    deviceId: d.deviceId,
                    temperature: d.espTemprature,
                    humidity: d.espHumidity,
                    odour: d.espOdour
                }));

            // AQI alerts
            const aqiAlerts = venueDevices
                .filter((d) => d.aqiAlert)
                .map((d) => ({
                    deviceId: d.deviceId,
                    temperature: d.espTemprature,
                    humidity: d.espHumidity,
                    AQI: d.espAQI
                }));

            // Gas alerts
            const glAlerts = venueDevices
                .filter((d) => d.glAlert)
                .map((d) => ({
                    deviceId: d.deviceId,
                    temperature: d.espTemprature,
                    humidity: d.espHumidity,
                    gass: d.espGL
                }));

            return {
                venueId: venue._id,
                venueName: venue.name,
                totalDevices: venueDevices.length,

                // Total active alerts in this venue
                totalAlerts: devicesWithAlerts.length,

                // Temperature alerts
                temperatureAlertCount: temperatureAlerts.length,
                temperatureAlertDevices: temperatureAlerts,

                // Humidity alerts
                humidityAlertCount: humidityAlerts.length,
                humidityAlertDevices: humidityAlerts,

                // Odour alerts
                odourAlertCount: odourAlerts.length,
                odourAlertDevices: odourAlerts,

                // AQI alerts
                aqiAlertCount: aqiAlerts.length,
                aqiAlertDevices: aqiAlerts,

                // Gas alerts
                glAlertCount: glAlerts.length,
                glAlertDevices: glAlerts,
            };
        });

        res.json({ organizationId, venues: result });
    } catch (err) {
        console.error("Error fetching alerts:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { getAlerts };
