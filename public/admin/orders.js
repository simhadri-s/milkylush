import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  orderBy, 
  limit,
  where,
  Timestamp,
  updateDoc // Import updateDoc for status update
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db } from "../firebase.js"; // Assuming firebase.js exports auth and db
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js"; // Import onAuthStateChanged and signOut

// DOM elements
const ordersTableBody = document.querySelector("#ordersTable tbody");
const downloadBtn = document.getElementById("downloadExcel");
const loadingElement = document.getElementById("loading");
const errorElement = document.getElementById("error");
const filterSubscriptionSelect = document.getElementById("filterSubscription");
const filterStatusSelect = document.getElementById("filterStatus");
const searchInput = document.getElementById("searchInput");
const totalOrdersElement = document.getElementById("totalOrders");
const totalRevenueElement = document.getElementById("totalRevenue");

// Data storage
let allOrders = [];
let filteredOrders = [];
let isAdmin = false; // Flag to track admin status

// --- Admin Access Control ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("User is logged in:", user.uid);
    // Check if the user is an admin
    const adminDocRef = doc(db, "admin", user.uid);
    const adminDocSnap = await getDoc(adminDocRef);

    if (adminDocSnap.exists()) {
      console.log("User is an administrator.");
      isAdmin = true;
      // Fetch and display orders only if admin
      fetchOrders();
    } else {
      console.warn("User is not authorized to view this page.");
      showAccessDenied();
    }
  } else {
    console.log("No user logged in.");
    showAccessDenied();
  }
});

function showAccessDenied() {
  document.body.innerHTML = `
    <div class="container text-center mt-5">
      <div class="alert alert-danger" role="alert">
        <h4 class="alert-heading">Access Denied!</h4>
        <p>You do not have permission to view this page. Please log in with an administrator account.</p>
        <hr>
        <button class="btn btn-primary" id="loginRedirect">Go to Login</button>
        <button class="btn btn-secondary" id="logoutBtn">Logout</button>
      </div>
    </div>
  `;
  document.getElementById('loginRedirect')?.addEventListener('click', () => {
    // Redirect to your login page. Adjust the path as needed.
    window.location.href = '/login.html'; 
  });
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.reload(); // Reload to show access denied
  });
}

// --- Utility functions (mostly unchanged) ---
const formatPrice = (price) => {
  const numPrice = parseFloat(price) || 0;
  return numPrice.toLocaleString('en-IN', { 
    style: 'currency', 
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "N/A";
  
  try {
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid Date";
  }
};

const showLoading = (show) => {
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
};

const showError = (message) => {
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
};

const hideError = () => {
  if (errorElement) {
    errorElement.style.display = 'none';
  }
};

// --- Main fetch function (mostly unchanged, fetches all necessary data) ---
async function fetchOrders() {
  if (!isAdmin) {
    console.log("Not an admin. Skipping order fetch.");
    return;
  }

  showLoading(true);
  hideError();
  
  try {
    console.log("Fetching orders from booking-info collection...");
    
    const bookingsQuery = query(
      collection(db, "booking-info"),
      orderBy("timestamp", "desc")
    );
    
    const bookingsSnap = await getDocs(bookingsQuery);
    console.log(`Found ${bookingsSnap.docs.length} bookings`);
    
    const orders = [];
    let totalRevenue = 0;

    for (const docSnap of bookingsSnap.docs) {
      const booking = docSnap.data();
      const bookingId = docSnap.id;

      try {
        let userName = "Unknown";
        let userAddress = "Not provided";
        let phoneNo = "Not provided";

        if (booking.userInfo) {
          userName = booking.userInfo.name || "Unknown";
          userAddress = booking.userInfo.address || "Not provided";
          phoneNo = booking.userInfo.phone || "Not provided";
        } else {
          try {
            const userSnap = await getDoc(doc(db, "user-info", booking.userId));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userName = userData.name || "Unknown";
              userAddress = userData.address || "Not provided";
              phoneNo = userData.phone || "Not provided";
            }
          } catch (userError) {
            console.warn(`Could not fetch user info for ${booking.userId}:`, userError);
          }
        }

        let productName = "Unknown Product";
        let productPrice = 0;

        if (booking.productName) {
          productName = booking.productName;
          productPrice = booking.totalAmount || 0;
        } else {
          try {
            const productSnap = await getDoc(doc(db, "products", booking.productId));
            if (productSnap.exists()) {
              const productData = productSnap.data();
              productName = productData.product_name || "Unknown Product";
              productPrice = (booking.quantity || 0) * (parseFloat(productData.price) || 0);
            }
          } catch (productError) {
            console.warn(`Could not fetch product info for ${booking.productId}:`, productError);
          }
        }

        if (!productPrice && booking.quantity) {
          try {
            const productSnap = await getDoc(doc(db, "products", booking.productId));
            if (productSnap.exists()) {
              const productData = productSnap.data();
              productPrice = booking.quantity * (parseFloat(productData.price) || 0);
            }
          } catch (error) {
            console.warn("Could not calculate price:", error);
          }
        }

        const order = {
          id: bookingId,
          userId: booking.userId || "Unknown",
          userName,
          productName,
          quantity: booking.quantity || 0,
          totalAmount: productPrice,
          userAddress,
          phoneNo,
          bookingDate: formatDate(booking.timestamp),
          timestamp: booking.timestamp,
          subscribed: booking.subscribed || false,
          status: booking.status || "pending" // Default status
        };

        orders.push(order);
        totalRevenue += productPrice;

      } catch (orderError) {
        console.error(`Error processing order ${bookingId}:`, orderError);
        orders.push({
          id: bookingId,
          userId: booking.userId || "Unknown",
          userName: "Error loading",
          productName: "Error loading",
          quantity: booking.quantity || 0,
          totalAmount: 0,
          userAddress: "Error loading",
          phoneNo: "Error loading",
          bookingDate: formatDate(booking.timestamp),
          timestamp: booking.timestamp,
          subscribed: booking.subscribed || false,
          status: booking.status || "error"
        });
      }
    }

    allOrders = orders;
    filteredOrders = [...orders];
    
    console.log(`Processed ${orders.length} orders`);
    
    updateSummary(orders.length, totalRevenue);
    displayOrders(filteredOrders); // Display orders after fetching
    
    showLoading(false);

  } catch (error) {
    console.error("Error fetching orders:", error);
    showError("Failed to load orders. Please try again.");
    showLoading(false);
  }
}

// --- Display orders in table (modified for status update) ---
function displayOrders(orders) {
  if (!ordersTableBody) return;

  ordersTableBody.innerHTML = "";

  if (orders.length === 0) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 20px; color: #666;">
          No orders found
        </td>
      </tr>
    `;
    return;
  }

  orders.forEach(order => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.userName}</td>
      <td>${order.productName}</td>
      <td>${order.quantity}</td>
      <td>${formatPrice(order.totalAmount)}</td>
      <td>${order.userAddress}</td>
      <td>${order.phoneNo}</td>
      <td>${order.bookingDate}</td>
      <td>
        <span class="badge ${order.subscribed ? 'badge-success' : 'badge-primary'}">
          ${order.subscribed ? 'Subscription' : 'One-time'}
        </span>
      </td>
      <td>
        <select class="form-select status-select" data-order-id="${order.id}">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    `;
    
    ordersTableBody.appendChild(tr);
  });

  // Add event listeners for status changes after all rows are added
  document.querySelectorAll('.status-select').forEach(selectElement => {
    selectElement.addEventListener('change', (event) => {
      const orderId = event.target.dataset.orderId;
      const newStatus = event.target.value;
      updateOrderStatus(orderId, newStatus);
    });
  });
}

// --- New function to update order status ---
async function updateOrderStatus(orderId, newStatus) {
  try {
    const orderRef = doc(db, "booking-info", orderId);
    await updateDoc(orderRef, {
      status: newStatus
    });
    console.log(`Order ${orderId} status updated to: ${newStatus}`);
    // Optionally, refresh a specific order or all orders to reflect change
    // For simplicity, we'll just update the local filteredOrders array
    const orderIndex = filteredOrders.findIndex(order => order.id === orderId);
    if (orderIndex > -1) {
      filteredOrders[orderIndex].status = newStatus;
      // Re-displaying filtered orders to ensure UI consistency if needed
      // displayOrders(filteredOrders); 
    }
    alert(`Order ${orderId} status updated to ${newStatus}!`);
  } catch (error) {
    console.error("Error updating order status:", error);
    showError(`Failed to update status for order ${orderId}.`);
  }
}

// --- Update summary statistics (unchanged) ---
function updateSummary(totalOrders, totalRevenue) {
  if (totalOrdersElement) {
    totalOrdersElement.textContent = totalOrders;
  }
  
  if (totalRevenueElement) {
    totalRevenueElement.textContent = formatPrice(totalRevenue);
  }
}

// --- Filter functions (unchanged) ---
function applyFilters() {
  let filtered = [...allOrders];

  if (filterSubscriptionSelect?.value) {
    const isSubscription = filterSubscriptionSelect.value === 'subscription';
    filtered = filtered.filter(order => order.subscribed === isSubscription);
  }

  if (filterStatusSelect?.value) {
    filtered = filtered.filter(order => order.status === filterStatusSelect.value);
  }

  if (searchInput?.value) {
    const searchTerm = searchInput.value.toLowerCase();
    filtered = filtered.filter(order => 
      order.userName.toLowerCase().includes(searchTerm) ||
      order.productName.toLowerCase().includes(searchTerm) ||
      order.phoneNo.includes(searchTerm) ||
      order.userAddress.toLowerCase().includes(searchTerm)
    );
  }

  filteredOrders = filtered;
  displayOrders(filteredOrders);
  
  const filteredRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  updateSummary(filteredOrders.length, filteredRevenue);
}

// --- Excel download function (unchanged) ---
function downloadExcel() {
  if (filteredOrders.length === 0) {
    alert("No orders to download");
    return;
  }

  const excelData = filteredOrders.map(order => ({
    "Order ID": order.id,
    "Customer Name": order.userName,
    "Product Name": order.productName,
    "Quantity": order.quantity,
    "Total Amount (₹)": order.totalAmount,
    "Phone Number": order.phoneNo,
    "Address": order.userAddress,
    "Order Date": order.bookingDate,
    "Order Type": order.subscribed ? 'Subscription' : 'One-time',
    "Status": order.status,
    "User ID": order.userId
  }));

  try {
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    
    const filename = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    console.log(`Excel file downloaded: ${filename}`);
  } catch (error) {
    console.error("Error creating Excel file:", error);
    alert("Failed to create Excel file. Please try again.");
  }
}

// --- Event listeners ---
document.addEventListener("DOMContentLoaded", () => {
  // Download button
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadExcel);
  }

  // Filter controls
  if (filterSubscriptionSelect) {
    filterSubscriptionSelect.addEventListener("change", applyFilters);
  }

  if (filterStatusSelect) {
    filterStatusSelect.addEventListener("change", applyFilters);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  // Initial fetch will be triggered by onAuthStateChanged if user is admin
});

// Export functions for potential external use
window.ordersFunctions = {
  refreshOrders: fetchOrders,
  downloadExcel,
  applyFilters
};