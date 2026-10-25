import { useMemo, useState, useEffect } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createEvent,
  getAllEvents,
  deleteEvent,
} from "../services/eventService";

function CalendarView({ onClose, onEventsChanged }) {
  const today = new Date();
  const todayLocalKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [monthDate, setMonthDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState(null);

  const [form, setForm] = useState({
    title: "",
    date: todayLocalKey,
    time: "",
    period: "AM",
    description: "",
  });

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const days = useMemo(() => {
    const result = Array(offset).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(day);
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [offset, daysInMonth]);

  const monthTitle = monthDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const keyForDay = (day) =>
    day
      ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : "";

  const eventsFor = (day) =>
    events.filter((event) => event.date === keyForDay(day));



  const formatEvent = (event) => ({
    id: event._id,
    title: event.title,
    date: new Date(event.date).toISOString().slice(0, 10),
    time: event.time || "",
    description: event.description || "",
  });

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);

      const response = await getAllEvents();

      setEvents(
        response.data.events.map(formatEvent)
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to load events"
      );
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDeleteEvent = async (event) => {
    try {
      setDeletingEventId(event.id);
      await deleteEvent(event.id);
      setEvents((currentEvents) =>
        currentEvents.filter((item) => item.id !== event.id)
      );
      onEventsChanged?.();
      toast.success("Event deleted successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to delete event"
      );
    } finally {
      setDeletingEventId(null);
      setConfirmDeleteEventId(null);
    }
  };

  const saveEvent = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error("Event title is required");
      return;
    }

    if (!form.date) {
      toast.error("Please select a date");
      return;
    }

    try {
      setSavingEvent(true);

      const response = await createEvent({
        title: form.title.trim(),
        date: form.date,
        time: form.time
          ? `${form.time} ${form.period}`
          : "",
        description: form.description.trim(),
      });

      const event = formatEvent(response.data.event);

      setEvents((prev) => [...prev, event]);
      onEventsChanged?.();
      setShowForm(false);

      setForm({
        title: "",
        date: form.date,
        time: "",
        period: "AM",
        description: "",
      });

      const selected = new Date(`${event.date}T00:00:00`);

      setMonthDate(
        new Date(
          selected.getFullYear(),
          selected.getMonth(),
          1
        )
      );

      toast.success("Event added successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to create event"
      );
    } finally {
      setSavingEvent(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[240] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[86vh] max-h-[850px] min-h-[600px] rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <CalendarDays size={21} />
            </div>
            <div>
              <h2 className="font-semibold">Calendar</h2>
              <p className="text-xs text-slate-400">
                Plan and manage your events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={17} />
              Add Event
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <X size={21} />
            </button>
          </div>
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setMonthDate(new Date(year, month - 1, 1))
              }
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft size={19} />
            </button>

            <button
              onClick={() =>
                setMonthDate(
                  new Date(today.getFullYear(), today.getMonth(), 1)
                )
              }
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
            >
              Today
            </button>

            <button
              onClick={() =>
                setMonthDate(new Date(year, month + 1, 1))
              }
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            {monthTitle}
          </h3>

          <span className="text-sm text-slate-500">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          {loadingEvents ? (
            <div className="h-full min-h-[420px] flex items-center justify-center text-sm text-slate-500">
              Loading events...
            </div>
          ) : (
          <div className="w-full min-w-[680px] overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-7 bg-slate-50">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div
                  key={day}
                  className="px-3 py-3 border-r border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day, index) => (
                <div
                  key={`${day}-${index}`}
                  className={`min-h-[100px] min-w-0 overflow-hidden border-r border-b border-slate-200 p-1.5 sm:min-h-[115px] sm:p-2 ${
                    day ? "bg-white" : "bg-slate-50/60"
                  }`}
                >
                  {day && (
                    <>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          day === today.getDate() &&
                          month === today.getMonth() &&
                          year === today.getFullYear()
                            ? "bg-indigo-600 text-white"
                            : "text-slate-700"
                        }`}
                      >
                        {day}
                      </div>

                      <div className="mt-1 space-y-2">
                        {eventsFor(day).map((event) => (
                          <div
                            key={event.id}
                            className="group min-w-0 rounded-lg border border-indigo-100 bg-indigo-50 px-1.5 py-1 sm:px-2 sm:py-1.5"
                          >
                            <div className="flex items-start gap-1">
                              <p className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-[10px] font-semibold text-indigo-700 sm:text-xs">
                                {event.title}
                              </p>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteEventId(event.id)}
                                disabled={deletingEventId === event.id}
                                title={`Delete ${event.title}`}
                                aria-label={`Delete event ${event.title}`}
                                className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {event.time && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock size={11} />
                                {event.time}
                              </p>
                            )}
                            {confirmDeleteEventId === event.id && (
                              <div className="mt-2 rounded-md border border-red-200 bg-white p-2">
                                <p className="text-[11px] font-medium text-slate-700">
                                  Delete this event?
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEvent(event)}
                                    disabled={deletingEventId === event.id}
                                    className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                  >
                                    {deletingEventId === event.id ? "Deleting..." : "Yes, delete"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteEventId(null)}
                                    disabled={deletingEventId === event.id}
                                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}
        </div>

        {showForm && (
          <div
            className="absolute inset-0 z-20 bg-slate-900/30 backdrop-blur-[1px] flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <form
              onSubmit={saveEvent}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Add Event
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Add a new event to your calendar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X size={19} />
                </button>
              </div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Event Title
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="Enter event title"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Time
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          time: e.target.value,
                        })
                      }
                      className="min-w-0 flex-1 px-3 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <select
                      value={form.period}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          period: e.target.value,
                        })
                      }
                      className="w-20 px-2 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">
                Description
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Add event details..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              <div className="flex justify-end gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                >
                  {savingEvent ? "Saving..." : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarView;