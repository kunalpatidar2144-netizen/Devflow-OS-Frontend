import { Pencil, Trash2, Star, Paperclip } from "lucide-react";

function NoteCard({
  id,
  title,
  description,
  category,
  date,
  isFavorite,
  onEdit,
  onDelete,
  onFavorite,
  onOpen,
  actionLoading,
  attachments = [],
}) {
  return (
    <div
      onClick={() => onOpen(id)}
      className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition cursor-pointer"
    >
      {/* Top Section */}
      <div className="flex justify-between items-start">

        <div className="flex-1 pr-4">
          <h2 className="text-xl font-semibold text-slate-800">
            {title}
          </h2>

          <p className="text-slate-500 mt-2 line-clamp-2">
            {description}
          </p>
        </div>

        {/* Action Icons */}
        <div
          className="flex gap-2"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Favorite */}
          <button
            onClick={() => onFavorite(id)}
            disabled={actionLoading}
            title={
              isFavorite
                ? "Remove from Favorites"
                : "Add to Favorites"
            }
            className={`p-2 rounded-lg transition ${
              isFavorite
                ? "text-yellow-500 hover:bg-yellow-50"
                : "text-slate-400 hover:bg-yellow-50 hover:text-yellow-500"
            }`}
          >
            <Star
              size={18}
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(id)}
            disabled={actionLoading}
            title="Edit Note"
            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition disabled:opacity-50"
          >
            <Pencil size={18} />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(id)}
            disabled={actionLoading}
            title="Delete Note"
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition disabled:opacity-50"
          >
            <Trash2 size={18} />
          </button>

        </div>

      </div>

      {/* Loading Line */}
      {actionLoading && (
        <div
          className="mt-5 h-1 w-full bg-slate-200 rounded-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-full w-1/2 bg-violet-500 rounded-full animate-note-progress"></div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
        <div className="flex items-center gap-3">
          <span>{category}</span>
          {attachments.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"><Paperclip size={12} /> {attachments.length} {attachments.length === 1 ? "file" : "files"}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span>{date}</span>
        </div>
      </div>

    </div>
  );
}

export default NoteCard;