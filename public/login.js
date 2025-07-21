import { auth } from "./firebase.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";


const provider = new GoogleAuthProvider();

document.getElementById("google-login").addEventListener("click", () => {
  if(!auth.currentUser){
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      document.getElementById("status").textContent =
        `✅ Logged in as: ${user.displayName} (${user.email})`;
      console.log("User info:", user);
      // Optional: redirect to home page
      window.location.href = "shop.html";
    })
    .catch((error) => {
      console.error(error);
      document.getElementById("status").textContent =
        `🚫 Error: ${error.message}`;
    });
  }else {
    signOut(auth).then(() => {
      window.location.reload();
      console.log("logged out!");
    })
    .catch((error) => {
      console.log("Error signing our:", error);
    });
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ User is logged in:", user.uid);
    document.getElementById('google-login').innerHTML = `logout`;
  } else {
    document.getElementById('google-login').innerHTML = `Sign in with Google`;
  }
});