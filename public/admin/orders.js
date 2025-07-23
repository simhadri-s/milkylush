import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  orderBy, 
  updateDoc,
  deleteDoc // Import deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// DOM elements
const ordersTableBody = document.querySelector("#ordersTable tbody");
const downloadBtn = document.getElementById("downloadExcel");
const loadingElement = document.getElementById("loading");
const errorElement = document.getElementById("error");
const filterSubscriptionSelect = document.getElementById("filterSubscription");
const filterStatusSelect = document.getElementById("filterStatus");
const searchInput = document.getElementById("searchInput");
const filterDateInput = document.getElementById("filterDate"); // New date filter input
const totalOrdersElement = document.getElementById("totalOrders");
const totalRevenueElement = document.getElementById("totalRevenue");

// Data storage
let allOrders = [];
let filteredOrders = [];
let isAdmin = false;

// --- Admin Access Control ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const adminDocRef = doc(db, "admin", user.uid);
    const adminDocSnap = await getDoc(adminDocRef);
    if (adminDocSnap.exists()) {
      isAdmin = true;
      fetchOrders();
    } else {
      showAccessDenied();
    }
  } else {
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
        <button class="btn btn-primary" onclick="window.location.href='/login.html'">Go to Login</button>
      </div>
    </div>`;
}

// --- Utility functions ---
const formatPrice = (price) => {
  return (parseFloat(price) || 0).toLocaleString('en-IN', { 
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "N/A";
  try {
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata", year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
  } catch (error) {
    return "Invalid Date";
  }
};

const showLoading = (show) => { loadingElement.style.display = show ? 'block' : 'none'; };
const showError = (message) => { errorElement.textContent = message; errorElement.style.display = 'block'; };
const hideError = () => { errorElement.style.display = 'none'; };

// --- Main fetch function ---
async function fetchOrders() {
  if (!isAdmin) return;
  showLoading(true);
  hideError();
  try {
    const bookingsQuery = query(collection(db, "booking-info"), orderBy("timestamp", "desc"));
    const bookingsSnap = await getDocs(bookingsQuery);
    
    const ordersPromises = bookingsSnap.docs.map(async (docSnap) => {
      const booking = docSnap.data();
      let userName = "Unknown", userAddress = "N/A", phoneNo = "N/A";

      if (booking.userInfo) {
        userName = booking.userInfo.name || "Unknown";
        userAddress = booking.userInfo.address || "N/A";
        phoneNo = booking.userInfo.phone || "N/A";
      }

      let productName = booking.productName || "Unknown Product";
      let productPrice = booking.totalAmount || 0;

      return {
        id: docSnap.id,
        userId: booking.userId || "Unknown",
        userName,
        productName,
        quantity: booking.quantity || 0,
        totalAmount: productPrice,
        userAddress,
        phoneNo,
        bookingDate: formatDate(booking.timestamp),
        timestamp: booking.timestamp, // Keep original timestamp for filtering
        subscribed: booking.subscribed || false,
        status: booking.status || "pending"
      };
    });

    allOrders = await Promise.all(ordersPromises);
    applyFilters();
    showLoading(false);

  } catch (error) {
    console.error("Error fetching orders:", error);
    showError("Failed to load orders. Please try again.");
    showLoading(false);
  }
}

// --- Display orders in table ---
function displayOrders(orders) {
  ordersTableBody.innerHTML = "";
  if (orders.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-3">No orders match the current filters.</td></tr>`;
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
      <td><span class="badge ${order.subscribed ? 'badge-success' : 'badge-primary'}">${order.subscribed ? 'Subscription' : 'One-time'}</span></td>
      <td>
        <select class="form-select status-select" data-order-id="${order.id}" data-original-status="${order.status}">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    `;
    ordersTableBody.appendChild(tr);
  });
}

// --- Status Update and Deletion Logic ---
async function handleStatusChange(orderId, newStatus, originalStatus, selectElement) {
    // Confirmation Dialog
    const isDeleting = newStatus === 'cancelled';
    const confirmationMessage = isDeleting 
      ? "Are you sure you want to CANCEL and DELETE this order? This action cannot be undone."
      : `Are you sure you want to update status to '${newStatus}'?`;

    if (!window.confirm(confirmationMessage)) {
      selectElement.value = originalStatus; // Revert dropdown on cancel
      return;
    }

    // Perform Action
    try {
        if (isDeleting) {
            await deleteOrderFromFirestore(orderId);
            alert(`Order ${orderId} has been successfully deleted.`);
        } else {
            await updateOrderStatusInFirestore(orderId, newStatus);
            alert(`Order ${orderId} status updated to ${newStatus}.`);
        }
    } catch (error) {
        console.error(`Failed to ${isDeleting ? 'delete' : 'update'} order:`, error);
        showError(`Error: Could not ${isDeleting ? 'delete' : 'update'} order. Please try again.`);
        selectElement.value = originalStatus; // Revert on error
    }
}

async function updateOrderStatusInFirestore(orderId, newStatus) {
    const orderRef = doc(db, "booking-info", orderId);
    await updateDoc(orderRef, { status: newStatus });
    
    // Update local data to avoid re-fetch
    const orderInAll = allOrders.find(o => o.id === orderId);
    if (orderInAll) orderInAll.status = newStatus;
    
    applyFilters(); // Re-apply filters to show updated state
}

async function deleteOrderFromFirestore(orderId) {
    const orderRef = doc(db, "booking-info", orderId);
    await deleteDoc(orderRef);
    
    // Remove from local data to avoid re-fetch
    allOrders = allOrders.filter(o => o.id !== orderId);

    applyFilters(); // Re-apply filters to show updated state
}


// --- Update summary statistics ---
function updateSummary(orders) {
  const totalCount = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  totalOrdersElement.textContent = totalCount;
  totalRevenueElement.textContent = formatPrice(totalRevenue);
}

// --- Filter Logic ---
function applyFilters() {
  let filtered = [...allOrders];

  // Subscription Filter
  if (filterSubscriptionSelect?.value) {
    const isSubscription = filterSubscriptionSelect.value === 'subscription';
    filtered = filtered.filter(order => order.subscribed === isSubscription);
  }

  // Status Filter
  if (filterStatusSelect?.value) {
    filtered = filtered.filter(order => order.status === filterStatusSelect.value);
  }

  // Date Filter
  if (filterDateInput?.value) {
      const selectedDate = new Date(filterDateInput.value);
      const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

      filtered = filtered.filter(order => {
          if (!order.timestamp || !order.timestamp.toDate) return false;
          const orderDate = order.timestamp.toDate();
          return orderDate >= startOfDay && orderDate <= endOfDay;
      });
  }

  // Search Filter
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
  updateSummary(filteredOrders);
}

// --- Excel download function ---
function downloadExcel() {
  if (filteredOrders.length === 0) {
    alert("No orders to download for the current filters.");
    return;
  }
  const excelData = filteredOrders.map(order => ({
    "Order ID": order.id, "Customer Name": order.userName, "Product Name": order.productName,
    "Quantity": order.quantity, "Total Amount (₹)": order.totalAmount, "Phone Number": order.phoneNo,
    "Address": order.userAddress, "Order Date": order.bookingDate, 
    "Order Type": order.subscribed ? 'Subscription' : 'One-time', "Status": order.status
  }));
  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// --- Event listeners ---
document.addEventListener("DOMContentLoaded", () => {
  downloadBtn?.addEventListener("click", downloadExcel);
  filterSubscriptionSelect?.addEventListener("change", applyFilters);
  filterStatusSelect?.addEventListener("change", applyFilters);
  searchInput?.addEventListener("input", applyFilters);
  filterDateInput?.addEventListener("change", applyFilters); // Listener for new date filter

  // Delegated event listener for status changes
  ordersTableBody?.addEventListener('change', (event) => {
    if (event.target.classList.contains('status-select')) {
      const selectElement = event.target;
      const orderId = selectElement.dataset.orderId;
      const newStatus = selectElement.value;
      const originalStatus = selectElement.dataset.originalStatus;
      handleStatusChange(orderId, newStatus, originalStatus, selectElement);
    }
  });
});

// Expose functions for buttons in HTML
window.ordersFunctions = { refreshOrders: fetchOrders };