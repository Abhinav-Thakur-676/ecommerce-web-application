require("dotenv").config();

const mailjet = require("node-mailjet").connect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_SECRET_KEY
);

module.exports= function(email ,token , callback)
{
const request = mailjet.post('send', { version: 'v3.1' }).request({
  Messages: [
    {
      From: {
        Email: 'tabhinav003@gmail.com',
        Name: 'Me',
      },
      To: [
        {
          Email: email,
          Name: 'Recepient',
        },
      ],
      Subject: 'Reset Your Password',
      TextPart: 'We help you to reset your password.',
      HTMLPart: `
     <h3>
            Password reset link sent to you .
            <a href="${process.env.APP_URL}/reset-password/${token}">
              Click the link .
            </a>!
     </h3>
     <br />
       `,    },
  ],
})
request
  .then(result => {
    console.log(result.body)
    callback(null ,result.body)
  })
  .catch(err => {
    console.log(err);
    callback(err , null)

  })
}

