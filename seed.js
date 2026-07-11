require("dotenv").config();

const fs = require("fs");
const mongoose = require("mongoose");

const User = require("./models/User");
const Product = require("./models/Product");

async function seedDatabase()
{
    try
    {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("✅ MongoDB Connected");

        // Read Users
        const users = JSON.parse(
            fs.readFileSync("./db.txt", "utf8")
        );

        // Read Products
        const products = JSON.parse(
            fs.readFileSync("./products.txt", "utf8")
        );

        // Remove Existing Data
        await User.deleteMany({});
        await Product.deleteMany({});

        // Insert Fresh Data
        await User.insertMany(users);
        await Product.insertMany(products);

        console.log("✅ Users Imported:", users.length);
        console.log("✅ Products Imported:", products.length);

        console.log("🎉 Database Seeded Successfully");

        process.exit();
    }
    catch(err)
    {
        console.log(err);
        process.exit();
    }
}

seedDatabase();