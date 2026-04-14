document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const authStatus = document.getElementById("auth-status");
  const userPanel = document.getElementById("user-panel");
  const currentUserSpan = document.getElementById("current-user");
  const logoutButton = document.getElementById("logout-button");

  let authToken = null;
  let currentUser = null;

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setAuthState(user, token) {
    authToken = token;
    currentUser = user;
    localStorage.setItem("authToken", token);
    currentUserSpan.textContent = `${user.email} (${user.role})`;
    userPanel.classList.remove("hidden");
    authStatus.classList.remove("hidden");
    authStatus.textContent = `Signed in as ${user.email}`;
    registerForm.classList.add("hidden");
    loginForm.classList.add("hidden");
  }

  function clearAuthState() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    currentUserSpan.textContent = "";
    userPanel.classList.add("hidden");
    authStatus.classList.add("hidden");
    registerForm.classList.remove("hidden");
    loginForm.classList.remove("hidden");
  }

  async function refreshUser(token) {
    try {
      const response = await fetch("/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        clearAuthState();
        return;
      }

      const user = await response.json();
      setAuthState(user, token);
    } catch (error) {
      clearAuthState();
      console.error("Error refreshing user:", error);
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "";

      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = "-- Select an activity --";
      activitySelect.appendChild(placeholderOption);

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");

    if (!authToken) {
      showMessage("Please log in to unregister from an activity.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      showMessage("Please log in first to sign up for an activity.", "error");
      return;
    }

    const activity = document.getElementById("activity").value;
    if (!activity) {
      showMessage("Choose an activity before signing up.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const role = document.getElementById("role").value;

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, role }),
      });

      const result = await response.json();
      if (response.ok) {
        setAuthState({ email: result.email, role: result.role }, result.token);
        showMessage("Registration successful. You are now signed in.", "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "Registration failed.", "error");
      }
    } catch (error) {
      showMessage("Failed to register. Please try again.", "error");
      console.error("Error registering:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (response.ok) {
        setAuthState({ email: result.email, role: result.role }, result.token);
        showMessage("Login successful.", "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "Login failed.", "error");
      }
    } catch (error) {
      showMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", () => {
    clearAuthState();
    showMessage("You have been logged out.", "info");
  });

  const savedToken = localStorage.getItem("authToken");
  if (savedToken) {
    refreshUser(savedToken).then(fetchActivities);
  } else {
    fetchActivities();
  }
});
