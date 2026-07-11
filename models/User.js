const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    id: Number,
    name: String,
    image: String,
    price: Number,
    quantity: Number
});

const orderSchema = new mongoose.Schema({
    orderId: String,
    date: String,
    items: [orderItemSchema],
    total: Number,
    status: {
        type: String,
        default: "Pending"
    }
});

const cartSchema = new mongoose.Schema({
    productId: Number,
    quantity: Number
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    username: {
        type: String,
        required: true,
        unique: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    isVarified: {
        type: Boolean,
        default: false
    },

    mailToken: {
        type: String,
        default: null
    },

    resetToken: {
        type: String,
        default: null
    },

    cart: [cartSchema],

    orders: [orderSchema]
});

module.exports = mongoose.model("User", userSchema);