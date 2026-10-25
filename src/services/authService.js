import API from "../config/api";

export const loginUser = (data) => {
  return API.post("/users/login", data);
};

export const signupUser = (data) => {
  return API.post("/users/signup", data);
};