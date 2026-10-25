import API from "../config/api";

export const createEvent = (eventData) => API.post("/events/create", eventData);
export const getAllEvents = () => API.get("/events");
export const updateEvent = (id, eventData) => API.put(`/events/${id}`, eventData);
export const deleteEvent = (id) => API.delete(`/events/${id}`);
export const getEventReminders = () => API.get("/events/reminders");
