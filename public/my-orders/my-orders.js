import { auth, db } from "../firebase.js";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc, 
  getDoc,
  orderBy 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Global variables
let currentUser = null;
let orders = [];
let orderToCancel = null;

// Utility functions
const formatPrice = (price) => {
  const numPrice = parseInt(price) || 0;
  return numPrice.toLocaleString('en-IN');
};

const showAlert = (message, type = 'info') => {
  // Create a toast notification
  const toastContainer = document.getElementById('toastContainer') || createToastContainer();
  const toast = createToast(message, type);
  toastContainer.appendChild(toast);
  
  // Show toast
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
  
  // Remove toast after it's hidden
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
};

const createToastContainer = () => {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container position-fixed top-0 end-0 p-3';
  container.style.zIndex = '1056';
  document.body.appendChild(container);
  return container;
};

const createToast = (message, type) => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  
  const bgClass = type === 'error' ? 'bg-danger' : type === 'success' ? 'bg-success' : 'bg-info';
  
  toast.innerHTML = `
    <div class="toast-header ${bgClass} text-white">
      <strong class="me-auto">${type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info'}</strong>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;
  
  return toast;
};

const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusClass = (status) => {
  const statusMap = {
    pending: 'status-pending',
    confirmed: 'status-confirmed',
    cancelled: 'status-cancelled',
    delivered: 'status-delivered'
  };
  return statusMap[status] || 'status-pending';
};

const canCancelOrder = (order) => {
  // Only allow cancellation for pending orders
  return order.status === 'pending';
};

// Authentication handler
const handleAuthStateChange = (user) => {
  currentUser = user;
  const loginBtn = document.getElementById('login');
  
  if (user) {
    console.log("✅ User is logged in:", user.uid);
    if (loginBtn) {
      loginBtn.textContent = 'Logout';
      loginBtn.classList.remove('btn-outline-light');
      loginBtn.classList.add('btn-outline-danger');
    }
    loadUserOrders(user.uid);
  } else {
    console.log("🚫 No user is logged in.");
    window.location.href = "../login.html";
  }
};

// Load user orders
const loadUserOrders = async (uid) => {
  try {
    // First, try the simple query without ordering to avoid index requirement
    const q = query(
      collection(db, "booking-info"),
      where("userId", "==", uid)
    );
    
    const querySnapshot = await getDocs(q);
    orders = [];
    
    querySnapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort orders by timestamp on the client side (most recent first)
    orders.sort((a, b) => {
      const timestampA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
      const timestampB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
      return timestampB - timestampA;
    });
    
    // Fetch product details for each order
    await fetchProductDetails();
    
    console.log("Loaded orders with product details:", orders);
    displayOrders();
    
  } catch (error) {
    console.error("Error loading orders:", error);
    showAlert("Failed to load orders. Please try again.", "error");
    hideLoading();
  }
};

// Fetch product details for all orders
const fetchProductDetails = async () => {
  try {
    const productPromises = orders.map(async (order) => {
      if (order.productId) {
        try {
          const productRef = doc(db, "products", order.productId);
          const productSnap = await getDoc(productRef);
          
          if (productSnap.exists()) {
            const productData = productSnap.data();
            order.productImage = productData.product_img || '../img/default-product.jpg';
            order.productName = productData.product_name || order.productName || 'Unknown Product';
            order.productPrice = productData.price || 0;
          } else {
            console.warn(`Product not found for order ${order.id}:`, order.productId);
            order.productImage = '../img/default-product.jpg';
          }
        } catch (error) {
          console.error(`Error fetching product ${order.productId}:`, error);
          order.productImage = '../img/default-product.jpg';
        }
      } else {
        order.productImage = '../img/default-product.jpg';
      }
    });
    
    await Promise.all(productPromises);
    
  } catch (error) {
    console.error("Error fetching product details:", error);
    // Continue with default images if product fetch fails
  }
};

// Display orders
const displayOrders = () => {
  hideLoading();
  
  const ordersContainer = document.getElementById('ordersContainer');
  const noOrdersDiv = document.getElementById('noOrders');
  
  if (orders.length === 0) {
    ordersContainer.style.display = 'none';
    noOrdersDiv.style.display = 'block';
    return;
  }
  
  noOrdersDiv.style.display = 'none';
  ordersContainer.style.display = 'block';
  
  ordersContainer.innerHTML = orders.map(order => createOrderCard(order)).join('');
  
  // Add event listeners to cancel buttons
  setupCancelButtons();
};

// Create order card HTML
const createOrderCard = (order) => {
  const canCancel = canCancelOrder(order);
  const statusClass = getStatusClass(order.status);
  
  return `
    <div class="order-card">
      <div class="order-header">
        <div class="row align-items-center">
          <div class="col-md-6">
            <h5 class="mb-1">Order #${order.id.slice(-8)}</h5>
            <p class="order-date mb-0">
              <i class="fas fa-calendar"></i> ${formatDate(order.timestamp)}
              ${order.subscribed ? '<span class="subscription-badge">Subscription</span>' : ''}
            </p>
          </div>
          <div class="col-md-6 text-md-end">
            <span class="order-status ${statusClass}">
              <i class="fas fa-circle"></i> ${order.status}
            </span>
          </div>
        </div>
      </div>
      
      <div class="order-item">
        <div class="row align-items-center">
          <div class="col-md-2">
            <img src="${order.productImage || '../img/default-product.jpg'}" 
                 alt="${order.productName || 'Product'}" 
                 class="product-image"
                 onerror="this.src='../img/default-product.jpg'">
          </div>
          <div class="col-md-6">
            <h6 class="mb-1">${order.productName || 'Unknown Product'}</h6>
            <p class="text-muted mb-1">Quantity: ${order.quantity}</p>
            <p class="text-muted mb-0">
              <i class="fas fa-user"></i> ${order.userInfo?.name || 'N/A'}
            </p>
            <p class="text-muted mb-0">
              <i class="fas fa-phone"></i> ${order.userInfo?.phone || 'N/A'}
            </p>
            <p class="text-muted mb-0">
              <i class="fas fa-map-marker-alt"></i> ${order.userInfo?.address || 'N/A'}
            </p>
          </div>
          <div class="col-md-2 text-center">
            <h5 class="mb-0 text-primary">₹${formatPrice(order.totalAmount)}</h5>
          </div>
          <div class="col-md-2 text-end">
            ${canCancel ? `
              <button class="cancel-btn" data-order-id="${order.id}" data-bs-toggle="modal" data-bs-target="#cancelModal">
                <i class="fas fa-times"></i> Cancel
              </button>
            ` : order.status === 'cancelled' ? `
              <span class="badge bg-secondary">Cancelled</span>
            ` : `
              <span class="badge bg-success">Cannot Cancel</span>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
};

// Setup cancel buttons
const setupCancelButtons = () => {
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orderId = e.target.closest('.cancel-btn').dataset.orderId;
      orderToCancel = orders.find(order => order.id === orderId);
      
      if (orderToCancel) {
        // Update modal content
        document.getElementById('cancelModalLabel').textContent = 
          `Cancel Order #${orderToCancel.id.slice(-8)}`;
        
        const modalBody = document.querySelector('#cancelModal .modal-body');
        modalBody.innerHTML = `
          <p>Are you sure you want to cancel this order?</p>
          <div class="card">
            <div class="card-body">
              <h6>${orderToCancel.productName}</h6>
              <p class="mb-1">Quantity: ${orderToCancel.quantity}</p>
              <p class="mb-0">Total: ₹${formatPrice(orderToCancel.totalAmount)}</p>
            </div>
          </div>
          <p class="text-muted mt-2">This action cannot be undone and the order will be permanently deleted.</p>
        `;
      }
    });
  });
};

// Handle order cancellation
const handleOrderCancellation = async () => {
  if (!orderToCancel) return;
  
  try {
    // Show loading state
    const confirmBtn = document.getElementById('confirmCancel');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Cancelling...';
    confirmBtn.disabled = true;
    
    // Delete the order from Firestore
    await deleteDoc(doc(db, "booking-info", orderToCancel.id));
    
    // Remove the order from local array
    orders = orders.filter(order => order.id !== orderToCancel.id);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('cancelModal'));
    modal.hide();
    
    // Refresh display
    displayOrders();
    
    showAlert("Order cancelled successfully!", "success");
    
    // Reset button state
    confirmBtn.textContent = originalText;
    confirmBtn.disabled = false;
    orderToCancel = null;
    
  } catch (error) {
    console.error("Error cancelling order:", error);
    showAlert("Failed to cancel order. Please try again.", "error");
    
    // Reset button state
    const confirmBtn = document.getElementById('confirmCancel');
    confirmBtn.textContent = 'Cancel Order';
    confirmBtn.disabled = false;
  }
};

// Handle logout
const handleLogout = async () => {
  try {
    await signOut(auth);
    console.log("User logged out successfully");
    window.location.href = "../login.html";
  } catch (error) {
    console.error("Error signing out:", error);
    showAlert("Error logging out. Please try again.", "error");
  }
};

// Setup login button
const setupLoginButton = () => {
  const loginBtn = document.getElementById('login');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentUser) {
        handleLogout();
      } else {
        window.location.href = "../login.html";
      }
    });
  }
};

// Hide loading state
const hideLoading = () => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
};

// Initialize the application
const initializeApp = () => {
  setupLoginButton();
  
  // Setup cancel confirmation
  const confirmCancelBtn = document.getElementById('confirmCancel');
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', handleOrderCancellation);
  }
  
  // Reset modal state when closed
  const cancelModal = document.getElementById('cancelModal');
  if (cancelModal) {
    cancelModal.addEventListener('hidden.bs.modal', () => {
      orderToCancel = null;
      const confirmBtn = document.getElementById('confirmCancel');
      confirmBtn.textContent = 'Cancel Order';
      confirmBtn.disabled = false;
    });
  }
};

// Event Listeners
document.addEventListener("DOMContentLoaded", initializeApp);

// Authentication state listener
onAuthStateChanged(auth, handleAuthStateChange);