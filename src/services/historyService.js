import API from "../config/api";

export const getHistory = (params = {}) => API.get("/history", { params });
export const createHistory = (data) => API.post("/history", data);
export const updateHistory = (id, data) => API.put(`/history/${id}`, data);
export const deleteHistory = (id) => API.delete(`/history/${id}`);
