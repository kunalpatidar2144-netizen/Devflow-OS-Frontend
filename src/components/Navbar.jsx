
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Bell,
  User,
  Rocket,
  CalendarDays,
  Clock,
  ChevronDown,
  X,
  UserRound,
} from "lucide-react";

function Navbar({
  search = "",
  setSearch = () => {},
  eventNotifications = [],
  onOpenCalendar,
  onOpenProfile,
  user = null,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  // Close either popover when the user clicks anywhere outside it.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const displayName = user?.fullName || user?.name || "My Profile";
  const displayEmail = user?.email || "";

  return (
    <nav className="relative z-40 flex flex-wrap items-center justify-between gap-4 bg-white px-4 py-4 shadow-md sm:px-6 lg:px-8">
      {/* Logo */}
      <div className="flex shrink-0 items-center gap-3">
        <Rocket size={32} className="text-blue-600" />

        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            DevFlow OS
          </h1>
          <p className="text-xs text-gray-500 sm:text-sm">
            Build • Organize • Innovate
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative order-3 w-full sm:order-none sm:w-64 lg:w-96">
        <Search
          size={18}
          className="absolute left-3 top-3 text-gray-400"
        />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes..."
          aria-label="Search notes"
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Right Side */}
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowProfileMenu(false);
            }}
            className="relative rounded-xl p-2 transition hover:bg-yellow-50"
            title="Notifications"
            aria-label="Open notifications"
            aria-expanded={showNotifications}
          >
            <Bell
              size={25}
              className="text-yellow-500 transition hover:text-yellow-600"
            />

            {eventNotifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {eventNotifications.length > 99
                  ? "99+"
                  : eventNotifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:w-96">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Notifications
                  </h3>
                  <p className="text-xs text-gray-500">
                    Your upcoming events
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                  aria-label="Close notifications"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {eventNotifications.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Bell
                      size={28}
                      className="mx-auto mb-2 text-gray-300"
                    />
                    <p className="text-sm font-medium text-gray-600">
                      No upcoming reminders
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Add an event in your calendar to see it here.
                    </p>
                  </div>
                ) : (
                  eventNotifications.map((event) => (
                    <div
                      key={event._id || event.id || event.title}
                      className="border-b px-4 py-3 transition hover:bg-yellow-50"
                    >
                      <p className="break-words font-medium text-gray-800">
                        {event.title || "Untitled event"}
                      </p>

                      <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <CalendarDays
                          size={14}
                          className="shrink-0 text-blue-500"
                        />
                        {event.date
                          ? new Date(event.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Date unavailable"}
                      </p>

                      {event.time && (
                        <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <Clock
                            size={14}
                            className="shrink-0 text-blue-500"
                          />
                          {event.time}
                        </p>
                      )}

                      {event.description && (
                        <p className="mt-2 break-words text-xs text-gray-500">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowNotifications(false);
                  onOpenCalendar?.();
                }}
                className="w-full bg-gray-50 px-4 py-3 text-sm font-medium text-blue-600 transition hover:bg-gray-100"
              >
                Open Calendar
              </button>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu((prev) => !prev);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-white transition hover:bg-blue-700 sm:px-4"
            aria-label="Open profile menu"
            aria-expanded={showProfileMenu}
          >
            <User size={18} />
            <span className="max-w-24 truncate">{displayName}</span>
            <ChevronDown size={15} />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-12 z-50 w-64 max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              <div className="border-b bg-blue-50 px-4 py-4">
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <UserRound size={24} />
                </div>

                <p className="break-words font-semibold text-gray-800">
                  {displayName}
                </p>

                <p className="mt-1 break-all text-xs text-gray-500">
                  {displayEmail || "Email not available"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onOpenProfile?.();
                }}
                className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                View Full Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
