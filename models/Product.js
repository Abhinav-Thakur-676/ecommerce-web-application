const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({

    id: {
        type: Number,
        unique: true
    },

    name: {
        type: String,
        required: true
    },

    image: {
        type: String,
        required: true
    },

    description: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true
    },

    stock: {
        type: Number,
        required: true
    }

});

module.exports = mongoose.model("Product", productSchema);
