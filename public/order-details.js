import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const formatPrice = (price) => {
    const numPrice = parseInt(price) || 0;
    return numPrice.toLocaleString('en-IN');
};

const showAlert = (message, type = 'info') => {
    // You can replace this with a better notification system
    alert(message);
};

// Function to get booking ID from URL
const getBookingId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
};

// Function to load and display order details
const loadOrderDetails = async () => {
    const bookingId = getBookingId();
    const orderDetailsContainer = document.getElementById('orderDetails');

    if (!bookingId) {
        orderDetailsContainer.innerHTML = `<p class="text-danger">No order ID found.</p>`;
        showAlert("No order ID provided. Redirecting to shop.", "error");
        setTimeout(() => {
            window.location.href = "../shop.html";
        }, 2000);
        return;
    }

    try {
        const docRef = doc(db, "booking-info", bookingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const order = docSnap.data();
            console.log("Fetched Order data:", order);

            orderDetailsContainer.innerHTML = `
                <h2>Order ID: <small>${bookingId}</small></h2>
                <p><strong>Product Name:</strong> ${order.productName}</p>
                <p><strong>Quantity:</strong> ${order.quantity}</p>
                <p><strong>Total Amount:</strong> ₹${formatPrice(order.totalAmount)}</p>
                <p><strong>Order Status:</strong> <span class="badge bg-info">${order.status.toUpperCase()}</span></p>
                <p><strong>Type:</strong> ${order.subscribed ? 'Monthly Subscription' : 'One-time Purchase'}</p>
                <p><strong>Booked On:</strong> ${order.timestamp.toDate().toLocaleString()}</p>
                <hr>
                <h3>Delivery Information</h3>
                <p><strong>Name:</strong> ${order.userInfo.name}</p>
                <p><strong>Phone:</strong> ${order.userInfo.phone}</p>
                <p><strong>Address:</strong> ${order.userInfo.address}</p>
            `;
            orderDetailsContainer.classList.remove('loading');
        } else {
            orderDetailsContainer.innerHTML = `<p class="text-danger">Order details not found.</p>`;
            showAlert("Order details not found. It might have been deleted or is invalid.", "error");
        }
    } catch (err) {
        console.error("Error fetching order details:", err);
        orderDetailsContainer.innerHTML = `<p class="text-danger">Error loading order details.</p>`;
        showAlert("Failed to load order details. Please try again later.", "error");
    }
};

// Initialize order details page
document.addEventListener("DOMContentLoaded", loadOrderDetails);

// Removed the incomplete handleLogout function as it's not directly related to displaying order details.
// If you wish to implement logout functionality on this page, please ensure 'auth' is properly imported and handled.