require("dotenv").config();

const mailjet = require("node-mailjet").connect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_SECRET_KEY
);

module.exports= function(email , callback)
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
          Name: 'Recipient',
        },
      ],
      Subject: 'Password Changed Successfully',
      TextPart: 'Your password has been changed successfully.',
      HTMLPart: `
         <h3>Password Changed Successfully</h3>

         <p>Your password has been updated successfully.</p>

         <p>If you did not perform this action, please contact support immediately.</p>
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


