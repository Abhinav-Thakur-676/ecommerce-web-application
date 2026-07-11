require("dotenv").config();

const connectDB = require("./config/db");
const User = require("./models/User");

connectDB();

const express = require('express')
const path = require("path");
const bcrypt = require('bcrypt');
const crypto = require("crypto");
const fs = require('fs')

const session= require('express-session')

const checkAuth = require("./middlewares/checkAuth");
const checkAdmin = require("./middlewares/checkAdmin");

const sendEmails = require("./methods/sendEmails");
const changedEmail = require("./methods/changedEmail");
const resetPassword = require("./methods/resetPassword");

const multer = require("multer");
const storage = multer.diskStorage({
    destination: function (req, file , cb)
    {
        cb(null,"./public/images");
    },

    filename:function(res , file , cb)
    {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer(
    {
        storage : storage , 
        // appling limits 
        limits:
        {
            fileSize: 250 * 1024
        },

        // Allow only JPG , JPEG and PNG images
        fileFilter: function(req , file , cb)

        {
           const allowedTypes = 
           [
             "image/jpeg",
             "image/jpg",
             "image/png"
           ];

           if(allowedTypes.includes(file.mimetype))
           {
              cb(null , true);
           }
           else
           {
              cb(new Error("Only JPG , JPEG and PNG images are allowed"));
           }
        }

    });

const ADMIN = {
    username: "admin",
    password: "admin6966"
};

const app = express()
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true}));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))



app.set("view engine" , "ejs");

// helper functions

function readData(filePath , callback)
{
    fs.readFile( filePath , "utf-8" , function(err , data)
    {

        if(err)
        {
            callback(err , null);
            return;
        }

        let parsedData = [];

        try
        {

        
        if(data.trim())
        {
            parsedData = JSON.parse(data);
        }

         return callback(null , parsedData);
        }
        catch(err)
        {
            return callback(err , null);
        }

    });
}

function writeData(filePath , data , callback)
{
    fs.writeFile(filePath , JSON.stringify(data , null , 4) , function(err)
    {
        if(err)
        {
            return callback(err);
            
        }

        return callback(null);


    })
}

function findIndex(array, key, value)
{
    for(let i = 0; i < array.length; i++)
    {
        if(array[i][key] === value)
        {
            return i;
        }
    }

    return -1;
}

function findItem(array, key, value)
{
    for(let i = 0; i < array.length; i++)
    {
        if(array[i][key] === value)
        {
            return array[i];
        }
    }

    return null;
}

//root page
app.get('/' , (req,res) =>
{
    res.render("root");
})

// Signup Route
app.route("/signup").get(function(req, res)
{
    res.render("signup", { error: "" });

}).post(function(req, res)
{
    let { name, username, email, password } = req.body;

    email = email.trim().toLowerCase();

    User.findOne({
        $or: [
            { username: username },
            { email: email }
        ]
    }).then(function(existingUser)
    {
        if(existingUser)
        {
            if(existingUser.username === username)
            {
                res.render("signup", {
                    error: "User already exists"
                });
                return;
            }

            if(existingUser.email === email)
            {
                res.render("signup", {
                    error: "Email already exists"
                });
                return;
            }
        }

        bcrypt.hash(password, 10, function(err, hash)
        {
            if(err)
            {
                res.render("signup", {
                    error: "Something went wrong"
                });
                return;
            }

            const user = new User({
                name: name,
                username: username,
                email: email,
                password: hash,
                isVarified: false,
                mailToken: crypto.randomUUID(),
                cart: [],
                orders: []
            });

            user.save().then(function()
            {
                sendEmails(email, user.mailToken, function(err)
                {
                    if(err)
                    {
                        res.render("signup", {
                            error: "Unable to send verification email"
                        });
                        return;
                    }

                    res.render("checkEmail");
                });
            }).catch(function()
            {
                res.render("signup", {
                    error: "Something went wrong"
                });
            });
        });

    }).catch(function()
    {
        res.render("signup", {
            error: "Something went wrong"
        });
    });
});

// Login Page
app.route("/login").get(function(req, res)
{
    res.render("login", { error: "" });

}).post(function(req, res)
{
    let { identifier, password } = req.body;

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.render("login", { error: "Something went wrong" });
            return;
        }

        let user = findItem(users, "username", identifier);

        if(!user)
        {
            user = findItem(users, "email", identifier);
        }

        if(!user)
        {
            res.render("login", {
                error: "Invalid Credentials"
            });
            return;
        }

        if(!user.isVarified)
        {
            res.render("login", {
                error: "Please verify your email first"
            });
            return;
        }

        bcrypt.compare(password, user.password, function(err, result)
        {
            if(err)
            {
                res.render("login", {
                    error: "Something went wrong"
                });
                return;
            }

            if(!result)
            {
                res.render("login", {
                    error: "Invalid Credentials"
                });
                return;
            }

            req.session.is_logged_in = true;
            req.session.user = user;

            res.redirect("/home");
        });
    });
});

// Verification Mail
app.get("/verifymail/:token", function(req, res)
{
    const { token } = req.params;

    User.findOne({ mailToken: token })
    .then(function(user)
    {
        if(!user)
        {
            res.send("User not found");
            return;
        }

        // Verify User
        user.isVarified = true;
        user.mailToken = null;

        user.save()
        .then(function()
        {
            req.session.is_logged_in = true;
            req.session.user = user;

            res.redirect("/home");
        })
        .catch(function()
        {
            res.send("Unable to verify user");
        });
    })
    .catch(function()
    {
        res.send("Something went wrong");
    });
});

// Home
app.get("/home", checkAuth, function(req, res)
{
    let page = Number(req.query.page) || 1;

    readData("./products.txt", function(err, products)
    {
        if(err)
        {
            res.send("Unable to load products.");
            return;
        }

        let visibleProducts = products.slice(0, page * 5);

        res.render("home", {
            user: req.session.user,
            products: visibleProducts,
            page: page,
            totalProducts: products.length
        });
    });
});

// Password Change
app.route("/change-password").get(checkAuth, function(req, res)
{
    res.render("changePassword", {
        error: ""
    });

}).post(checkAuth, function(req, res)
{
    let { current_password, new_password, confirm_password } = req.body;

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong");
            return;
        }

        const index = findIndex(users, "username", req.session.user.username);

        if(index === -1)
        {
            res.send("User not found");
            return;
        }

        console.log("User found");

        bcrypt.compare(current_password, users[index].password, function(err, result)
        {
            if(err)
            {
                res.render("changePassword", {
                    error: "Something went wrong"
                });
                return;
            }

            if(!result)
            {
                res.render("changePassword", {
                    error: "Current password is incorrect"
                });
                return;
            }

            console.log("Current password is correct");

            if(new_password === confirm_password)
            {
                bcrypt.hash(new_password, 10, function(err, hash)
                {
                    if(err)
                    {
                        res.send("Something went wrong.");
                        return;
                    }

                    users[index].password = hash;

                    writeData("./db.txt", users, function(err)
                    {
                        if(err)
                        {
                            res.render("changePassword", {
                                error: "Unable to update password"
                            });
                            return;
                        }

                        console.log("Password updated successfully");

                        changedEmail(users[index].email, function(err)
                        {
                            if(err)
                            {
                                res.render("changePassword", {
                                    error: "Unable to send email"
                                });
                                return;
                            }

                            req.session.destroy(function(err)
                            {
                                if(err)
                                {
                                    res.render("changePassword", {
                                        error: "Unable to logout"
                                    });
                                    return;
                                }

                                res.redirect("/login");
                            });
                        });
                    });
                });
            }
            else
            {
                res.send("Passwords do not match");
            }
        });
    });
});

// Forget Password
app.route("/forget-password").get(function(req, res)
{
    res.render("forgetPassword", {
        error: ""
    });

}).post(function(req, res)
{
    let Email = req.body.email;

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong");
            return;
        }

        const index = findIndex(users, "email", Email);

        if(index === -1)
        {
            res.send("If an account exists with this email, a password reset link has been sent.");
            return;
        }

        users[index].resetToken = crypto.randomUUID();

        writeData("./db.txt", users, function(err)
        {
            if(err)
            {
                res.send("Something went wrong");
                return;
            }

            resetPassword(
                users[index].email,
                users[index].resetToken,
                function(err)
                {
                    if(err)
                    {
                        res.send("Unable to send reset email");
                        return;
                    }

                    res.send("Password reset email sent successfully.");
                }
            );
        });
    });
});

// Reset Password
app.route("/reset-password/:token").get(function(req, res)
{
    const { token } = req.params;

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong");
            return;
        }

        const index = findIndex(users, "resetToken", token);

        if(index === -1)
        {
            res.send("Invalid reset link");
            return;
        }

        res.render("resetPassword", {
            error: "",
            token: token
        });
    });

}).post(function(req, res)
{
    const { token } = req.params;
    let { new_password, confirm_password } = req.body;

    // Empty password vaalidation
    if(!new_password  || !confirm_password)
    {
        res.render("resetPassword", {
            error: "Please fill in all fields",
            token: token
        });
        return;
    }

     // Minimum password length
    if(new_password.length < 8)
    {
        res.render("resetPassword", {
            error: "Password must be at least 8 characters long",
            token: token
        });
        return;
    }

    // Password confirmation
    if(new_password !== confirm_password)
    {
        res.render("resetPassword", {
            error: "Passwords do not match",
            token: token
        });
        return;
    }

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong");
            return;
        }

        const index = findIndex(users, "resetToken", token);

        if(index === -1)
        {
            res.send("Invalid reset link");
            return;
        }

        bcrypt.hash(new_password, 10, function(err, hash)
        {
            if(err)
            {
                res.send("Something went wrong");
                return;
            }

            users[index].password = hash;
            users[index].resetToken = null;

            writeData("./db.txt", users, function(err)
            {
                if(err)
                {
                    res.send("Unable to update password");
                    return;
                }

                res.redirect("/login");
            });
        });
    });
});

// My Cart Route
app.get("/my-cart", checkAuth, function(req, res)
{
    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const user = findItem(users, "username", req.session.user.username);

        if(user === null)
        {
           res.send("User not found.");
           return;
       }

       let cart = user.cart;

        readData("./products.txt", function(err, products)
        {
            if(err)
            {
                res.send("Something went wrong.");
                return;
            }

            let cartProducts = [];
            let totalPrice = 0;

            for(let i = 0; i < cart.length; i++)
            {
                for(let j = 0; j < products.length; j++)
                {
                    if(Number(cart[i].productId) === products[j].id)
                    {
                        cartProducts.push({
                            id: products[j].id,
                            name: products[j].name,
                            price: products[j].price,
                            image: products[j].image,
                            quantity: cart[i].quantity
                        });

                        totalPrice += products[j].price * cart[i].quantity;
                    }
                }
            }

            res.render("myCart", {
                cartProducts,
                totalPrice
            });
        });
    });
});

// Add to Cart
app.post("/add-to-cart/:productId", checkAuth , function(req, res)
{
    const productId = Number(req.params.productId);

    if(isNaN(productId))
      {
         res.send("Invalid product.");
         return;
      }

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const userIndex = findIndex(
            users,
            "username",
            req.session.user.username
        );

        if(userIndex === -1)
        {
            res.send("User not found.");
            return;
        }

        readData("./products.txt", function(err, products)
        {
            if(err)
            {
                res.send("Something went wrong.");
                return;
            }

            const product = findItem(
                products,
                "id",
                Number(productId)
            );

            if(product === null)
            {
                res.send("Product not found.");
                return;
            }

            if(product.stock <= 0)
            {
                res.send("Product is out of stock");
                return;

            }

            const cartIndex = findIndex(
                            users[userIndex].cart,
                            "productId",
                            productId
                        );

            if(cartIndex !== -1)
            {
                if(users[userIndex].cart[cartIndex].quantity >= product.stock)
                    {
                        res.send("Maximum available stock reached.");
                        return;

                    };

                    users[userIndex].cart[cartIndex].quantity++;
            }
            else
            {
                users[userIndex].cart.push({
                    productId: productId,
                    quantity: 1
                });
            }

            writeData("./db.txt", users, function(err)
            {
                if(err)
                {
                    res.send("Unable to update cart.");
                    return;
                }

                res.redirect("/home");
            });
        });
    });
});

// Increase Quantity
app.post("/increase-quantity/:productId", checkAuth , function(req, res)
{
    const productId = Number(req.params.productId);

    if(isNaN(productId))
    {
      res.send("Invalid product.");
      return;
    }

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const userIndex = findIndex(
                users,
                "username",
                req.session.user.username
            );

        if(userIndex === -1)
        {
            res.send("User not found.");
            return;
        }

        const cartIndex = findIndex(
              users[userIndex].cart,
              "productId",
              productId
        );

        if(cartIndex === -1)
        {
            res.send("Product not found in cart.");
            return;
        }

        readData("./products.txt", function(err, products)
        {
            if(err)
            {
                res.send("Something went wrong.");
                return;
            }

            const product = findItem(
                            products,
                            "id",
                            productId
                        );

            if(!product)
            {
                res.send("Product not found.");
                return;
            }

            if(users[userIndex].cart[cartIndex].quantity < product.stock)
            {
                users[userIndex].cart[cartIndex].quantity++;
            }
            else
            {
                res.send("Stock not available.");
                return;
            }

            writeData("./db.txt", users, function(err)
            {
                if(err)
                {
                    res.send("Unable to update cart.");
                    return;
                }

                res.redirect("/my-cart");
            });
        });
    });
});

// Decrease Quantity
app.post("/decrease-quantity/:productId", checkAuth , function(req, res)
{
    const productId = Number(req.params.productId);

    if(isNaN(productId))
    {
      res.send("Invalid product.");
      return;
    }

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const userIndex = findIndex(
            users,
            "username",
            req.session.user.username
        );

        if(userIndex === -1)
        {
            res.send("User not found.");
            return;
        }

        const cartIndex = findIndex(
            users[userIndex].cart,
            "productId",
            productId
        );

        if(cartIndex === -1)
        {
            res.send("Product not found in cart.");
            return;
        }

        if(users[userIndex].cart[cartIndex].quantity > 1)
        {
            users[userIndex].cart[cartIndex].quantity--;
        }
        else
        {
            users[userIndex].cart.splice(cartIndex, 1);
        }

        writeData("./db.txt", users, function(err)
        {
            if(err)
            {
                res.send("Unable to update cart.");
                return;
            }

            res.redirect("/my-cart");
        });
    });
});

// Delete Product
app.post("/delete-product/:productId",checkAuth , function(req, res)
{
    const productId = Number(req.params.productId);

    if(isNaN(productId))
    {
      res.send("Invalid product.");
      return;
    }

    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const userIndex = findIndex(
            users,
            "username",
            req.session.user.username
        );

        if(userIndex === -1)
        {
            res.send("User not found.");
            return;
        }

        const cartIndex = findIndex(
            users[userIndex].cart,
            "productId",
            productId
        );

        if(cartIndex === -1)
        {
            res.send("Product doesn't exist.");
            return;
        }

        users[userIndex].cart.splice(cartIndex, 1);

        writeData("./db.txt", users, function(err)
        {
            if(err)
            {
                res.send("Unable to update cart.");
                return;
            }

            res.redirect("/my-cart");
        });
    });
});

// Checkout Page
app.get("/checkout", checkAuth ,function(req, res)
{
    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const user = findItem(users, "username", req.session.user.username);

        if(user === null)
        {
          res.send("User not found.");
          return;
        }

        let cart = user.cart;

        readData("./products.txt", function(err, products)
        {
            if(err)
            {
                res.send("Something went wrong.");
                return;
            }

            let cartProducts = [];
            let totalPrice = 0;

            for(let i = 0; i < cart.length; i++)
            {
                for(let j = 0; j < products.length; j++)
                {
                    if(Number(cart[i].productId) === products[j].id)
                    {
                        cartProducts.push({
                            id: products[j].id,
                            name: products[j].name,
                            price: products[j].price,
                            image: products[j].image,
                            quantity: cart[i].quantity
                        });

                        totalPrice += products[j].price * cart[i].quantity;
                    }
                }
            }

            res.render("checkout", {
                cartProducts,
                totalPrice
            });
        });
    });
});

// Place Order
app.post("/place-order", checkAuth, function(req, res)
{
    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const userIndex = findIndex(
            users,
            "username",
            req.session.user.username
        );

        if(userIndex === -1)
        {
            res.send("User not found.");
            return;
        }

        let cart = users[userIndex].cart;

        if(cart.length === 0)
        {
            return res.redirect("/my-cart");
        }

        readData("./products.txt", function(err, products)
        {
            if(err)
            {
                res.send("Something went wrong.");
                return;
            }

            // Create Order
            let order =
            {
                orderId: crypto.randomUUID(),
                date: new Date().toLocaleString(),
                items: [],
                total: 0,
                status: "Pending"
            };

            // Build order items
            for(let i = 0; i < cart.length; i++)
            {
                let productFound = false;

                for(let j = 0; j < products.length; j++)
                {
                    if(Number(cart[i].productId) === products[j].id)
                    {
                        productFound = true;

                        // Check stock
                        if(products[j].stock < cart[i].quantity)
                        {
                            res.send(products[j].name + " does not have enough stock.");
                            return;
                        }

                        order.items.push({
                            id: products[j].id,
                            name: products[j].name,
                            price: products[j].price,
                            image: products[j].image,
                            quantity: cart[i].quantity
                        });

                        order.total +=
                            products[j].price * cart[i].quantity;

                        // Reduce Stock
                        products[j].stock -= cart[i].quantity;

                        break;
                    }
                }

                if(!productFound)
                {
                    res.send("One or more products are no longer available.");
                    return;
                }
            }

            // Save updated products first
            writeData("./products.txt", products, function(err)
            {
                if(err)
                {
                    res.send("Unable to update product stock.");
                    return;
                }

                // Save Order
                users[userIndex].orders.push(order);

                // Empty Cart
                users[userIndex].cart = [];

                writeData("./db.txt", users, function(err)
                {
                    if(err)
                    {
                        res.send("Unable to place order.");
                        return;
                    }

                    res.redirect("/my-orders");
                });
            });
        });
    });
});

// My Orders
app.get("/my-orders",checkAuth , function(req, res)
{
    readData("./db.txt", function(err, users)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const user = findItem(users, "username", req.session.user.username);

        if(user === null)
        {
          res.send("User not found.");
          return;
        }

        const orders = user.orders;

        res.render("myOrders", {
            orders
        });
    });
});

//logout
app.get("/logout", function(req, res)
{
    req.session.destroy();
    res.redirect("/");
})

//Admin-login
app.route("/admin/login").get(function(req , res)
{

    res.render("adminLogin");

}).post(function(req, res)
{
    let{username , password} = req.body;

    if(username === ADMIN.username && password === ADMIN.password)
    {
        req.session.is_admin = true;
        res.redirect("/admin");
    }
    else
    {
        res.send("Invalid Admin Credentials.");

    }
})

//Admin
app.get("/admin" , checkAdmin, function(req , res)
{
    res.render("adminDashboard");
})

//Admin logout
app.get("/admin/logout" ,function(req , res)
{
    req.session.destroy(function(err)
    { 

        if(err)
        {
            res.send("Unable to logout.");
            return;
        }

        res.redirect("/admin/login");
    });
});

// Admin Products
app.get("/admin/products", checkAdmin, function(req, res)
{
    readData("./products.txt", function(err, products)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        res.render("adminProducts", {
            products: products
        });
    });
});

// Admin Add Product
app.route("/admin/products/add").get(checkAdmin, function(req, res)
{
    res.render("addProduct");

}).post(checkAdmin, upload.single("image"), function(req, res)
{
    const
    {
        name,
        description,
        price,
        stock
    } = req.body;

    if(!name || !description || !price || !stock)
    {
        return res.send("All fields are required.");
    }

    if(Number(price) <= 0)
    {
        return res.send("Price must be greater than 0.");
    }

    if(Number(stock) < 0)
    {
        return res.send("Stock cannot be negative.");
    }

    if(!req.file)
    {
        return res.send("Please upload an image.");
    }

    const image = "/images/" + req.file.filename;

    readData("./products.txt", function(err, products)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        let id = 1;

        if(products.length > 0)
        {
            id = products[products.length - 1].id + 1;
        }

        const newProduct =
        {
            id,
            name,
            image,
            description,
            price: Number(price),
            stock: Number(stock)
        };

        products.push(newProduct);

        writeData("./products.txt", products, function(err)
        {
            if(err)
            {
                res.send("Unable to add product.");
                return;
            }

            res.redirect("/admin/products");
        });
    });
});

// Edit Product
app.route("/admin/products/edit/:productId").get(checkAdmin, function(req, res)
{
    const productId = Number(req.params.productId);

    if(isNaN(productId))
    {
      res.send("Invalid product.");
      return;
    }

    readData("./products.txt", function(err, products)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const product = findItem(products, "id", productId);

        if(product === null)
        {
            res.send("Product not found.");
            return;
        }

        res.render("editProduct", {
            product: product
        });
    });

}).post(checkAdmin, upload.single("image"), function(req, res)
{
    const productId = Number(req.params.productId);

    const
    {
        name,
        description,
        price,
        stock
    } = req.body;

    // Validate required fields
    if(!name || !description || !price || !stock)
    {
        return res.send("All fields are required.");
    }

    // Validate price
    if(Number(price) <= 0)
    {
        return res.send("Price must be greater than 0.");
    }

    // Validate stock
    if(Number(stock) < 0)
    {
        return res.send("Stock cannot be negative.");
    }

    readData("./products.txt", function(err, products)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const productIndex = findIndex(products, "id", productId);

        if(productIndex === -1)
        {
            res.send("Product not found.");
            return;
        }

        const product = products[productIndex];

        // Update Product Details
        product.name = name;
        product.description = description;
        product.price = Number(price);
        product.stock = Number(stock);

        // Update Image Only If New Image Uploaded
        if(req.file)
        {
            product.image = "/images/" + req.file.filename;
        }

        writeData("./products.txt", products, function(err)
        {
            if(err)
            {
                res.send("Unable to update product.");
                return;
            }

            res.redirect("/admin/products");
        });
    });
});


// Delete Product
app.post("/admin/products/delete/:productId", checkAdmin, function(req, res)
{
    const productId = Number(req.params.productId);

    if(isNaN(productId))
    {
      res.send("Invalid product.");
      return;
    }

    readData("./products.txt", function(err, products)
    {
        if(err)
        {
            res.send("Something went wrong.");
            return;
        }

        const productIndex = findIndex(products, "id", productId);

        if(productIndex === -1)
        {
            res.send("Product not found.");
            return;
        }

        const deletedProduct = products[productIndex];

        products.splice(productIndex, 1);

        writeData("./products.txt", products, function(err)
        {
            if(err)
            {
                res.send("Unable to delete product.");
                return;
            }

            // Future Improvement:
            // Delete deletedProduct.image from public/images if desired.

            res.redirect("/admin/products");
        });
    });
});

// Page not found
app.use((req, res) => {
    res.status(404).send("Page Not Found");
});

// Error handling middleware
app.use(function(err, req, res, next)
{
    if(err instanceof multer.MulterError)
    {
        if(err.code === "LIMIT_FILE_SIZE")
        {
            return res.send("Image size must not exceed 250 KB.");
        }
    }

    if(err)
    {
        return res.send(err.message);
    }

    next();
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});


    
