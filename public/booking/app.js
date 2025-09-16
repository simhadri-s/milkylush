import { auth, db } from "../firebase.js";
import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  collection, 
  Timestamp,
  getDocs, // Added for fetching multiple documents if needed
  query, // Added for querying documents if needed
  where // Added for querying documents if needed
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Global variables
let fetchedUserData = {};
let currentProduct = null;
let currentUser = null;

// Utility functions
const formatPrice = (price) => {
  const numPrice = parseInt(price) || 0;
  return numPrice.toLocaleString('en-IN');
};

const showAlert = (message, type = 'info') => {
  // You can replace this with a better notification system
  alert(message);
};

const validateForm = (data) => {
  const errors = [];
  
  if (!data.name || data.name.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!data.phone || !/^[0-9]{10}$/.test(data.phone)) {
    errors.push('Phone number must be exactly 10 digits');
  }
  
  if (!data.address || data.address.length < 10) {
    errors.push('Please provide a detailed delivery address');
  }
  
  return errors;
};

// Authentication handler
const handleAuthStateChange = (user) => {
  currentUser = user;
  const loginBtn = document.getElementById('login');
  
  if (user) {
    console.log("✅ User is logged in:", user.uid);
    if (loginBtn) {
      loginBtn.textContent = 'Logout';
      loginBtn.classList.remove('btn-warning');
      loginBtn.classList.add('btn-danger');
    }
    loadUserData(user.uid);
  } else {
    console.log("🚫 No user is logged in.");
    window.location.href = "../login.html";
  }
};

// Get product ID from URL
const getProductId = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
};

const subscribeBtn = document.getElementById("subscribe");
const productId = getProductId();
  if (productId === "ghee-0.25l" || productId === "ghee-0.5l") {
    subscribeBtn.style.display = "none";
}

// Load user data
const loadUserData = async (uid) => {
  try {
    const docRef = doc(db, "user-info", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      fetchedUserData = docSnap.data();
      console.log("Fetched User data:", fetchedUserData);
      prefillUserInputs();
    } else {
      console.log("No user-info document found for this user.");
      fetchedUserData = {};
    }
  } catch (err) {
    console.error("Error fetching user-info:", err);
    showAlert("Failed to load user data", "error");
  }
};

// Prefill user inputs
const prefillUserInputs = () => {
  ["name", "phone", "address"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const val = fetchedUserData[id] ? String(fetchedUserData[id]).trim() : "";
    el.value = val;
    
    // Disable if value exists and is not empty
    el.disabled = val !== "";
  });
};

// Setup edit buttons
const setupEditButtons = () => {
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const field = document.getElementById(targetId);
      if (field) {
        field.disabled = false;
        field.focus();
      }
    });
  });
};

// Load product data
const loadProduct = async (id) => {
  try {
    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      currentProduct = docSnap.data();
      displayProduct(currentProduct);
      setupQuantityControls(currentProduct);
    } else {
      document.getElementById('productInfo').innerHTML = `<p class="text-danger">Product not found.</p>`;
    }
  } catch (err) {
    console.error("Error loading product:", err);
    document.getElementById('productInfo').innerHTML = `<p class="text-danger">Error loading product.</p>`;
  }
};

// Display product information
const displayProduct = (data) => {
  const price = parseInt(data.price) || 0;
  
  document.getElementById('productInfo').innerHTML = `
    <div class="product-display">
      <h2>${data['product_name'] || 'Product Name'}</h2>
      <img src="${data['product_img'] || '../img/default-product.jpg'}" 
           alt="${data['product_name'] || 'Product'}" 
           class="product-image" 
           style="width: 200px; height: 200px; object-fit: cover;" />
      <p class="price">Price: ₹${formatPrice(price)}</p>
      
      <div class="quantity-control">
        <button type="button" id="decrease" class="btn btn-sm btn-secondary">-</button>
        <input type="number" id="quantity" value="1" min="1" max="100" class="form-control" style="width: 80px; display: inline-block;" />
        <button type="button" id="increase" class="btn btn-sm btn-secondary">+</button>
      </div>

      <p id="total" class="total">Total: ₹${formatPrice(price)}</p>
    </div>
  `;
  
  // Set hidden product ID
  const productIdInput = document.getElementById('productId');
  if (productIdInput) {
    productIdInput.value = getProductId();
  }
  
};

// Setup quantity controls
const setupQuantityControls = (productData) => {
  const quantityInput = document.getElementById('quantity');
  const totalElement = document.getElementById('total');
  const increaseBtn = document.getElementById('increase');
  const decreaseBtn = document.getElementById('decrease');
  
  if (!quantityInput || !totalElement || !increaseBtn || !decreaseBtn) return;
  
  const price = parseInt(productData.price) || 0;
  
  const updateTotal = () => {
    const quantity = parseInt(quantityInput.value) || 1;
    const total = quantity * price;
    totalElement.textContent = `Total: ₹${formatPrice(total)}`;
  };
  
  increaseBtn.addEventListener('click', () => {
    const currentValue = parseInt(quantityInput.value) || 1;
    if (currentValue < 100) { // Set reasonable max limit
      quantityInput.value = currentValue + 1;
      updateTotal();
    }
  });
  
  decreaseBtn.addEventListener('click', () => {
    const currentValue = parseInt(quantityInput.value) || 1;
    if (currentValue > 1) {
      quantityInput.value = currentValue - 1;
      updateTotal();
    }
  });
  
  quantityInput.addEventListener('input', updateTotal);
  quantityInput.addEventListener('change', () => {
    const value = parseInt(quantityInput.value) || 1;
    if (value < 1) quantityInput.value = 1;
    if (value > 100) quantityInput.value = 100;
    updateTotal();
  });
};

// Global variable to track subscription intent
let isSubscriptionIntent = false;

// Handle form submission
const handleFormSubmission = async (e) => {
  e.preventDefault();
  
  if (!currentUser) {
    showAlert("You must be logged in to book.");
    return;
  }
  
  const uid = currentUser.uid;
  
  // Get the button that was clicked to determine subscription status
  const submitter = e.submitter;
  let isSubscription = isSubscriptionIntent; // Use the global variable as fallback
  
  if (submitter) {
    // Check by button value
    isSubscription = submitter.value === "true";
    
    // Backup check by button ID
    if (!isSubscription && submitter.id === "subscribe") {
      isSubscription = true;
    }
    
    // Backup check by data attribute
    if (!isSubscription && submitter.dataset.subscription === "true") {
      isSubscription = true;
    }
  }
  
  console.log("Subscription status:", isSubscription, "Button clicked:", submitter?.id);
  
  const updatedData = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    address: document.getElementById("address").value.trim()
  };
  
  // Validate form data
  const validationErrors = validateForm(updatedData);
  if (validationErrors.length > 0) {
    showAlert(validationErrors.join('\n'));
    return;
  }
  
  try {
    // Update user info if changed
    await updateUserInfoIfChanged(uid, updatedData);
    showInfiniteLoader('Processing...');
    // Save booking
    const bookingRef = await saveBooking(uid, isSubscription);
    
    showAlert(`✅ ${isSubscription ? 'Subscription' : 'Booking'} saved successfully!`);
    
    // Redirect after successful booking to the order details page
    setTimeout(() => {
      window.location.href = `../order-details.html?id=${bookingRef.id}`;
    }, 2000);
    
  } catch (err) {
    console.error("Error processing booking:", err);
    showAlert("❌ Failed to process booking. Please try again.");
  }
};

// Update user info if changed
const updateUserInfoIfChanged = async (uid, updatedData) => {
  let hasChanges = false;
  
  Object.keys(updatedData).forEach((key) => {
    const fetchedVal = fetchedUserData[key] ? String(fetchedUserData[key]).trim() : "";
    if (fetchedVal !== updatedData[key]) {
      hasChanges = true;
    }
  });
  
  if (hasChanges || Object.keys(fetchedUserData).length === 0) {
    await setDoc(doc(db, "user-info", uid), updatedData);
    fetchedUserData = updatedData; // Update local cache
    console.log("User info updated");
  }
};

// Save booking to Firestore
const saveBooking = async (uid, isSubscription) => {
  const quantity = parseInt(document.getElementById("quantity").value) || 1;
  const productId = getProductId();
  
  if (!productId) {
    throw new Error("Product ID is missing");
  }
  
  const bookingData = {
    userId: uid,
    productId,
    productName: currentProduct?.product_name || "Unknown Product",
    quantity,
    totalAmount: quantity * (parseInt(currentProduct?.price) || 0),
    timestamp: Timestamp.now(),
    subscribed: isSubscription,
    status: "pending",
    userInfo: {
      name: document.getElementById("name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      address: document.getElementById("address").value.trim()
    }
  };
  
  const docRef = await addDoc(collection(db, "booking-info"), bookingData);
  return docRef; // Return the document reference
};

// Handle logout
const handleLogout = async () => {
  try {
    await signOut(auth);
    console.log("User logged out successfully");
    window.location.href = "../login.html";
  } catch (error) {
    console.error("Error signing out:", error);
    showAlert("Error logging out. Please try again.");
  }
};

// Setup form submission and button handlers
const setupFormHandlers = () => {
  const bookingForm = document.getElementById("bookingForm");
  const subscribeBtn = document.getElementById("subscribe");
  const buyBtn = document.getElementById("book");
  
  if (bookingForm) {
    bookingForm.addEventListener("submit", handleFormSubmission);
  }
  
  // Add individual button click handlers to ensure proper subscription detection
  if (subscribeBtn) {
    subscribeBtn.addEventListener("click", (e) => {
      isSubscriptionIntent = true;
      console.log("Subscribe button clicked - setting subscription intent to true");
    });
  }
  
  if (buyBtn) {
    buyBtn.addEventListener("click", (e) => {
      isSubscriptionIntent = false;
      console.log("Buy button clicked - setting subscription intent to false");
    });
  }
};

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

// Get current address from Google Maps (Placeholder for actual API call)
const getAddressFromCoordinates = async (latitude, longitude) => {
    // In a real application, you would use a reverse geocoding API here, e.g., Google Maps Geocoding API.
    // Example: https://maps.googleapis.com/maps/api/geocode/json?latlng=LAT,LNG&key=YOUR_API_KEY
    // For demonstration, we'll return a static address.
    console.log(`Fetching address for Lat: ${latitude}, Lng: ${longitude}`);
    showAlert("Fetching your current location...");

    // Simulate an API call
    return new Promise(resolve => {
        setTimeout(() => {
            // This is a placeholder address. Replace with actual API response.
            resolve(`Simulated Address: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}, Near Landmark, City, State, PinCode`);
        }, 1500);
    });
};

// Handle "Get Current Location" button click
const handleGetLocation = () => {
    const addressField = document.getElementById('address');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const address = await getAddressFromCoordinates(latitude, longitude);
                addressField.value = address;
                addressField.disabled = false; // Enable for editing if needed
                showAlert("Location filled successfully!");
            } catch (error) {
                console.error("Error getting address from coordinates:", error);
                showAlert("Failed to get address. Please enter manually.");
            }
        }, (error) => {
            console.error("Geolocation error:", error);
            let errorMessage = "Unable to retrieve your location.";
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = "Location access denied. Please enable location services in your browser settings.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = "Location information is unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMessage = "The request to get user location timed out.";
                    break;
            }
            showAlert(errorMessage, "error");
        });
    } else {
        showAlert("Geolocation is not supported by your browser. Please enter your address manually.", "error");
    }
};

// Initialize the application
const initializeApp = () => {
  const productId = getProductId();
  
  if (!productId) {
    document.getElementById('productInfo').innerHTML = `<p class="text-warning">No product ID provided in URL.</p>`;
    setTimeout(() => {
      window.location.href = "../shop.html";
    }, 2000);
    return;
  }
  
  loadProduct(productId);
  setupLoginButton();
  setupFormHandlers();

  // Setup "Get Current Location" button
  const getLocationBtn = document.getElementById('getLocationBtn');
  if (getLocationBtn) {
    getLocationBtn.addEventListener('click', handleGetLocation);
  }
};

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  setupEditButtons();
});

// Authentication state listener
onAuthStateChanged(auth, handleAuthStateChange);

// Simple Infinite Loading Screen
class InfiniteLoader {
    constructor(options = {}) {
        this.options = {
            containerId: options.containerId || 'infiniteLoader',
            message: options.message || 'Loading...',
            spinnerSize: options.spinnerSize || 60,
            backgroundColor: options.backgroundColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            textColor: options.textColor || 'white',
            redirectUrl: options.redirectUrl || null,
            redirectDelay: options.redirectDelay || null
        };
        
        this.create();
        this.setupRedirect();
    }

    create() {
        const html = `
            <div id="${this.options.containerId}" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${this.options.backgroundColor};
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                font-family: Arial, sans-serif;
                color: ${this.options.textColor};
            ">
                <div class="infinite-spinner" style="
                    width: ${this.options.spinnerSize}px;
                    height: ${this.options.spinnerSize}px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top: 3px solid white;
                    border-radius: 50%;
                    animation: infiniteSpin 1s linear infinite;
                    margin-bottom: 30px;
                "></div>
                
                <div style="
                    font-size: 20px;
                    opacity: 0.9;
                ">${this.options.message}</div>
            </div>
            
            <style>
                @keyframes infiniteSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
    }

    setupRedirect() {
        if (this.options.redirectUrl && this.options.redirectDelay) {
            setTimeout(() => {
                this.redirect(this.options.redirectUrl);
            }, this.options.redirectDelay);
        }
    }

    redirect(url) {
        window.location.href = url;
    }

    hide() {
        const container = document.getElementById(this.options.containerId);
        if (container) {
            container.style.opacity = '0';
            setTimeout(() => container.remove(), 500);
        }
    }

    updateMessage(message) {
        const container = document.getElementById(this.options.containerId);
        const messageEl = container ? container.querySelector('div:last-child') : null;
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
}

// Simple function to show infinite loader
function showInfiniteLoader(message = 'Loading...', redirectUrl = null, delay = null) {
    return new InfiniteLoader({
        message: message,
        redirectUrl: redirectUrl,
        redirectDelay: delay
    });
}

// Redirect after specified time
function loadAndRedirect(url, delay = 3000, message = 'Redirecting...') {
    const loader = new InfiniteLoader({
        message: message,
        redirectUrl: url,
        redirectDelay: delay
    });
    return loader;
}

// Manual redirect function
function redirectTo(url, delay = 0) {
    if (delay > 0) {
        setTimeout(() => {
            window.location.href = url;
        }, delay);
    } else {
        window.location.href = url;
    }
}
