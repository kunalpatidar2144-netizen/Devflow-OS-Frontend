
import API from "../config/api";

export const getUserProfile = () =>
  API.get("/users/profile");

export const updateUserProfile = (profileData) =>
  API.put("/users/profile", profileData);

export const changePassword = (passwordData) =>
  API.put("/users/change-password", passwordData);
