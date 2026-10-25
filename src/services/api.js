
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach JWT token
API.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle API responses and alternate local backend ports
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error?.config;

    // Don't retry if there's no request, a server responded,
    // or a custom API URL is configured.
    if (
      !request ||
      error.response ||
      request._retriedAlternatePort ||
      import.meta.env.VITE_API_URL
    ) {
      return Promise.reject(error);
    }

    const currentBase = String(
      request.baseURL || API.defaults.baseURL || ""
    );

    let alternateBase = null;

    if (currentBase.includes(":5000/")) {
      alternateBase = "http://localhost:4000/api";
    } else if (currentBase.includes(":4000/")) {
      alternateBase = "http://localhost:5000/api";
    }

    if (!alternateBase) {
      return Promise.reject(error);
    }

    request._retriedAlternatePort = true;
    request.baseURL = alternateBase;

    return API.request(request);
  }
);

export default API;
