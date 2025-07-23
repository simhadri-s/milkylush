import { db, auth } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// --- DOM Elements ---
const orderDetailsContainer = document.getElementById('orderDetails');
const authLinkDesktop = document.getElementById('auth-link-desktop');
const authLinkMobile = document.getElementById('auth-link-mobile');

// --- Utility Functions ---
const formatPrice = (price) => {
    // Use parseFloat for safety and consistent currency formatting
    const numPrice = parseFloat(price) || 0;
    return numPrice.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR'
    });
};

const showAlert = (message, type = 'danger') => {
    // A simple, non-blocking alert display
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x p-3 m-3`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.style.zIndex = "1050";
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
};

// --- Authentication Handling ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, update UI to show "Logout"
        if(authLinkDesktop) {
            authLinkDesktop.textContent = 'Logout';
            authLinkDesktop.classList.remove('btn-warning');
            authLinkDesktop.classList.add('btn-danger');
            authLinkDesktop.href = '#';
            authLinkDesktop.onclick = handleLogout;
        }
        if(authLinkMobile) {
            authLinkMobile.textContent = 'Logout';
            authLinkMobile.href = '#';
            authLinkMobile.onclick = handleLogout;
        }
    } else {
        // User is signed out, update UI to show "Login"
         if(authLinkDesktop) {
            authLinkDesktop.textContent = 'Login';
            authLinkDesktop.classList.add('btn-warning');
            authLinkDesktop.classList.remove('btn-danger');
            authLinkDesktop.href = '../login.html';
            authLinkDesktop.onclick = null;
        }
        if(authLinkMobile) {
            authLinkMobile.textContent = 'Login';
            authLinkMobile.href = '../login.html';
            authLinkMobile.onclick = null;
        }
    }
});

const handleLogout = async (event) => {
    event.preventDefault(); // Prevent navigation
    try {
        await signOut(auth);
        showAlert("You have been logged out successfully.", "success");
        // Optionally redirect to home or login page after logout
        setTimeout(() => {
            window.location.href = "../index.html";
        }, 1500);
    } catch (error) {
        console.error("Logout Error:", error);
        showAlert("Failed to log out. Please try again.");
    }
};

// --- Order Details Logic ---
const loadOrderDetails = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');

    if (!bookingId) {
        orderDetailsContainer.innerHTML = `<p class="text-danger">No order ID found in the URL.</p>`;
        showAlert("No order ID provided. Redirecting to the shop.");
        setTimeout(() => window.location.href = "../shop.html", 2000);
        return;
    }

    try {
        const docRef = doc(db, "booking-info", bookingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const order = docSnap.data();
            const orderStatus = order.status || 'pending'; // Default to pending if not set

            orderDetailsContainer.innerHTML = `
                <h2>Order ID: <small class="text-muted">${bookingId}</small></h2>
                <hr>
                <p><strong>Product Name:</strong> ${order.productName || 'N/A'}</p>
                <p><strong>Quantity:</strong> ${order.quantity || 0}</p>
                <p><strong>Total Amount:</strong> ${formatPrice(order.totalAmount)}</p>
                <p><strong>Order Status:</strong> <span class="badge bg-info text-uppercase status-badge">${orderStatus}</span></p>
                <p><strong>Type:</strong> ${order.subscribed ? 'Monthly Subscription' : 'One-time Purchase'}</p>
                <p><strong>Booked On:</strong> ${order.timestamp.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                <hr>
                <h3>Delivery Information</h3>
                <p><strong>Name:</strong> ${order.userInfo.name || 'N/A'}</p>
                <p><strong>Phone:</strong> ${order.userInfo.phone || 'N/A'}</p>
                <p><strong>Address:</strong> ${order.userInfo.address || 'N/A'}</p>
            `;
            orderDetailsContainer.classList.remove('loading');
        } else {
            orderDetailsContainer.innerHTML = `<p class="text-danger fw-bold">Order not found.</p><p>This order may have been cancelled or the ID is incorrect.</p>`;
            showAlert("Order details not found. It might have been deleted or is invalid.");
            orderDetailsContainer.classList.remove('loading');
        }
    } catch (err) {
        console.error("Error fetching order details:", err);
        orderDetailsContainer.innerHTML = `<p class="text-danger">A server error occurred while loading order details.</p>`;
        showAlert("Failed to load order details. Please check your connection and try again.");
        orderDetailsContainer.classList.remove('loading');
    }
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", loadOrderDetails);