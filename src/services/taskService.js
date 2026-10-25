import API from "../config/api";

export const getTasks = (params = {}) => API.get("/tasks", { params });
export const createTask = (data) => API.post("/tasks", data);
export const updateTask = (id, data) => API.put(`/tasks/${id}`, data);
export const deleteTask = (id) => API.delete(`/tasks/${id}`);
export const generateTaskPlan = (data) => API.post("/tasks/plan", data);
