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
      Subject: 'Verify Your Email',
      TextPart: 'Welcome to our application. Please verify your email address.',
  
      HTMLPart: `
            <h3>
              Dear user , welcome to
             <a href="${process.env.APP_URL}/verifymail/${token}">
              Verify Your Email
             </a>!
            </h3>
            <br />
           
                 `    },
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

