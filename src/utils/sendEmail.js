// const nodemailer = require("nodemailer");
// const path = require("path");
// const dotenv = require("dotenv");
// dotenv.config();

// const sendEmail = async (to, subject, html) => {
//     const transporter = nodemailer.createTransport({
//         host: "smtp.mailgun.org",
//         port: 587,
//         secure: false,
//         auth: {
//             user: process.env.MAILGUN_EMAIL ,
//             pass: process.env.MAILGUN_PASS,
//         },
//     });

//     await transporter.sendMail({
//         from: `"FrostKontroll" <${process.env.MAILGUN_EMAIL}>`,
//         to,
//         subject,
//         html,
//         attachments: [
//             {
//                 filename: "logo.png",
//                 path: path.join(__dirname, "../assets/logo.png"), 
//                 cid: "companyLogo", 
//             },
//         ],
//     });
// };

// module.exports = sendEmail;


// const formData = require("form-data");
// const Mailgun = require("mailgun.js");
// const fs = require("fs");
// const path = require("path");

// const mailgun = new Mailgun(formData);
// const mg = mailgun.client({
//     username: "api",
//     key: process.env.MAILGUN_API_KEY
// });

// const sendEmail = async (to, subject, html) => {
//     try {
//         await mg.messages.create(process.env.MAILGUN_DOMAIN, {
//             from: `FrostKontroll <support@odor.iotfiysolutions.com>`,
//             to,
//             subject,
//             html,
//             attachment: [
//                 {
//                     filename: "logo.png",
//                     data: fs.createReadStream(path.join(__dirname, "../assets/logo.png"))
//                 }
//             ]
//         });

//         console.log("Email sent ✔");
//     } catch (err) {
//         console.error("Mailgun error:", err);
//     }
// };

// module.exports = sendEmail;

const formData = require("form-data");
const Mailgun = require("mailgun.js");
const fs = require("fs");
const path = require("path");

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY
});

const sendEmail = async (to, subject, html) => {
    try {
        await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: `LuckyOneMall <support@odor.iotfiysolutions.com>`,
            to,
            subject,
            html,

            // Attach inline image similar to Nodemailer "cid"
            inline: [
                {
                    filename: "logo.png",
                    data: fs.createReadStream(path.join(__dirname, "../assets/logo.png")),
                    knownLength: fs.statSync(path.join(__dirname, "../assets/logo.png")).size
                }
            ]
        });

        console.log("Email sent ✔");
    } catch (err) {
        console.error("Mailgun error:", err);
    }
};

module.exports = sendEmail;
