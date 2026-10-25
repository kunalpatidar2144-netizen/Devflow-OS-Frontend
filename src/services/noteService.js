import API from "../config/api";

export const getAllNotes = () => {
  return API.get("/notes");
};

const buildNoteFormData = (data, files = []) => {
  const formData = new FormData();

  formData.append("title", data.title || "");
  formData.append("content", data.content || "");

  files.forEach((file) => {
    formData.append("attachments", file);
  });

  return formData;
};

export const createNote = (data, files = []) => {
  return API.post(
    "/notes/create",
    buildNoteFormData(data, files),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
};

export const updateNote = (id, data, files = []) => {
  return API.put(
    `/notes/${id}`,
    buildNoteFormData(data, files),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
};

export const deleteNote = (id) => {
  return API.delete(`/notes/${id}`);
};

// Favorite
export const toggleFavorite = (id) => {
  return API.put(`/notes/${id}/favorite`);
};

// Archive
export const archiveNote = (id) => {
  return API.put(`/notes/${id}/archive`);
};

// Unarchive
export const unarchiveNote = (id) => {
  return API.put(`/notes/${id}/unarchive`);
};

// Get Archived Notes
export const getArchivedNotes = () => {
  return API.get("/notes/archived");
};

// Search Notes
export const searchNotes = (search) => {
  return API.get(
    `/notes/search?search=${encodeURIComponent(search)}`
  );
};