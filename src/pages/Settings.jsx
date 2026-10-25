import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserRound, BellRing, Palette, ShieldCheck, NotebookPen, BrainCircuit,
  Save, ArrowLeft, CheckCircle2, Monitor, Moon, Sun, LockKeyhole, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import Sidebar from "../components/Sidebar";
import { changePassword, getUserProfile, updateUserProfile } from "../services/userService";

const SETTINGS_KEY = "devflowSettings";
const DEFAULT_SETTINGS = {
  notifications: { eventReminders: true, browserNotifications: false, reminderMinutesBefore: 0 },
  appearance: { theme: "light" },
  notes: { sortBy: "newest", defaultView: "notes" },
  ai: { responseStyle: "balanced", summaryLength: "medium", quizDifficulty: "medium" },
};

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved.notifications || {}) },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...(saved.appearance || {}) },
      notes: { ...DEFAULT_SETTINGS.notes, ...(saved.notes || {}) },
      ai: { ...DEFAULT_SETTINGS.ai, ...(saved.ai || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applyTheme(theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("app-dark", Boolean(dark));
}

const sections = [
  { id: "account", label: "Account", description: "Your personal details", icon: UserRound },
  { id: "notifications", label: "Notifications", description: "Event reminders and alerts", icon: BellRing },
  { id: "appearance", label: "Appearance", description: "Theme and display", icon: Palette },
  { id: "security", label: "Security", description: "Password and account safety", icon: ShieldCheck },
  { id: "notes", label: "Notes", description: "How your notes are shown", icon: NotebookPen },
  { id: "ai", label: "AI Preferences", description: "Personalize AI tools", icon: BrainCircuit },
];

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium text-slate-800 dark-setting-text">{label}</p>
        {description && <p className="mt-1 text-sm text-slate-500 dark-setting-muted">{description}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function Field({ label, children, hint }) {
  return <label className="block space-y-2"><span className="text-sm font-semibold text-slate-700 dark-setting-text">{label}</span>{children}{hint && <span className="block text-xs text-slate-500 dark-setting-muted">{hint}</span>}</label>;
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Settings() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("account");
  const [settings, setSettings] = useState(readSettings);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null") || { fullName: "", email: "" }; }
    catch { return { fullName: "", email: "" }; }
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [originalProfile, setOriginalProfile] = useState(null);
  const [passwordData, setPasswordData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });

  useEffect(() => {
    applyTheme(settings.appearance.theme);
    let alive = true;
    getUserProfile().then((response) => {
      if (!alive) return;
      const user = response.data?.user;
      if (user) {
        setProfile(user);
        setOriginalProfile(user);
        const storage = localStorage.getItem("token") ? localStorage : sessionStorage;
        storage.setItem("user", JSON.stringify(user));
      }
    }).catch((error) => {
      toast.error(error.response?.data?.message || "Could not load profile details");
    }).finally(() => { if (alive) setProfileLoading(false); });
    return () => { alive = false; };
  }, []);

  const updatePreference = (group, key, value) => {
    setSettings((previous) => ({ ...previous, [group]: { ...previous[group], [key]: value } }));
  };

  // Theme selection is applied and persisted immediately so it survives reloads,
  // even when the user navigates away without pressing the Save button.
  const updateThemePreference = (theme) => {
    const nextSettings = {
      ...settings,
      appearance: { ...settings.appearance, theme },
    };

    setSettings(nextSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      applyTheme(theme);
      window.dispatchEvent(new CustomEvent("devflow-settings-updated", { detail: nextSettings }));
    } catch {
      toast.error("Could not save theme preference in this browser");
    }
  };

  const savePreferences = async () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      applyTheme(settings.appearance.theme);
      window.dispatchEvent(new CustomEvent("devflow-settings-updated", { detail: settings }));
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Could not save settings in this browser");
    }
  };

  const enableBrowserNotifications = async (enabled) => {
    if (!enabled) {
      const nextSettings = {
        ...settings,
        notifications: { ...settings.notifications, browserNotifications: false },
      };
      setSettings(nextSettings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      window.dispatchEvent(new CustomEvent("devflow-settings-updated", { detail: nextSettings }));
      toast.success("Browser notifications turned off");
      return;
    }

    if (!("Notification" in window)) {
      toast.error("This browser does not support notifications");
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      toast.error("Browser notifications require HTTPS (or localhost during development).");
      return;
    }

    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        updatePreference("notifications", "browserNotifications", false);
        if (permission === "denied") {
          toast.warning("Notifications are blocked for this site. Click the lock icon near the address bar, open Site settings, and allow Notifications.");
        } else {
          toast.warning("Notification permission was not granted. Allow it in your browser prompt/settings.");
        }
        return;
      }

      const nextSettings = {
        ...settings,
        notifications: { ...settings.notifications, browserNotifications: true },
      };
      setSettings(nextSettings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      window.dispatchEvent(new CustomEvent("devflow-settings-updated", { detail: nextSettings }));
      try {
        new Notification("DevFlow OS notifications enabled", {
          body: "You can now receive browser notifications for supported reminders.",
        });
      } catch (notificationError) {
        // Permission is granted; some browsers may still suppress the test notification.
      }
      toast.success("Browser notifications enabled");
    } catch (error) {
      toast.error("Could not enable notifications. Check your browser's site settings and try again.");
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.fullName?.trim() || !profile.email?.trim()) {
      toast.error("Name and email are required");
      return;
    }
    try {
      setProfileSaving(true);
      const response = await updateUserProfile({ fullName: profile.fullName.trim(), email: profile.email.trim() });
      const updated = response.data?.user || { ...profile, fullName: profile.fullName.trim(), email: profile.email.trim() };
      setProfile(updated);
      setOriginalProfile(updated);
      setIsEditingProfile(false);
      const storage = localStorage.getItem("token") ? localStorage : sessionStorage;
      storage.setItem("user", JSON.stringify(updated));
      toast.success("Account details updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update account details");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Please complete all password fields"); return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters"); return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match"); return;
    }
    try {
      setPasswordSaving(true);
      const response = await changePassword({ oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword });
      toast.success(response.data?.message || "Password changed successfully");
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const active = sections.find((section) => section.id === activeSection) || sections[0];
  const ActiveSectionIcon = active.icon;
  const input = (value, onChange, type = "text", extra = {}) => <input className={inputClass} value={value ?? ""} onChange={onChange} type={type} {...extra} />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 app-settings-shell">
      <Sidebar activeView="settings" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-10">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"><ArrowLeft size={16} /> Back to workspace</button>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Workspace preferences</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark-setting-heading">Settings</h1>
              <p className="mt-2 text-slate-500 dark-setting-muted">Manage your account, notifications, appearance and productivity tools.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700"><UserRound size={20} /></div>
              <div className="max-w-44"><p className="truncate text-sm font-semibold text-slate-800 dark-setting-text">{profile.fullName || "Your account"}</p><p className="truncate text-xs text-slate-500 dark-setting-muted">{profile.email || "Account settings"}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {sections.map((section) => {
                const Icon = section.icon;
                const selected = activeSection === section.id;
                return <button key={section.id} onClick={() => setActiveSection(section.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
                  <Icon size={19} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{section.label}</span><span className={`mt-0.5 block text-xs ${selected ? "text-blue-600/80" : "text-slate-400"}`}>{section.description}</span></span>
                </button>;
              })}
            </nav>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><ActiveSectionIcon size={22} /></div>
                <div><h2 className="text-xl font-bold text-slate-900 dark-setting-heading">{active.label}</h2><p className="mt-1 text-sm text-slate-500 dark-setting-muted">{active.description}</p></div>
              </div>

              {activeSection === "account" && <form onSubmit={saveProfile} className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark-setting-text">Personal Information</h3>
                    <p className="mt-1 text-sm text-slate-500 dark-setting-muted">Manage your name and email address.</p>
                  </div>
                  {!isEditingProfile && <button
                    type="button"
                    disabled={profileLoading}
                    onClick={() => {
                      setOriginalProfile({ ...profile });
                      setIsEditingProfile(true);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >Edit Profile</button>}
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark-setting-muted">
                  {profileLoading ? "Loading your profile…" : isEditingProfile ? "Update your details below, then save your changes." : "Your account details are shown below. Select Edit Profile to make changes."}
                </div>

                <Field label="Full name">{input(profile.fullName, (e) => setProfile({ ...profile, fullName: e.target.value }), "text", { autoComplete: "name", required: true, disabled: !isEditingProfile || profileLoading })}</Field>
                <Field label="Email address">{input(profile.email, (e) => setProfile({ ...profile, email: e.target.value }), "email", { autoComplete: "email", required: true, disabled: !isEditingProfile || profileLoading })}</Field>
                <Field label="Account created"><div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "Not available"}</div></Field>

                {isEditingProfile && <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={profileSaving || profileLoading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><Save size={17} /> {profileSaving ? "Saving…" : "Save Changes"}</button>
                  <button type="button" disabled={profileSaving} onClick={() => { setProfile(originalProfile || profile); setIsEditingProfile(false); }} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
                </div>}
              </form>}

              {activeSection === "notifications" && <div className="divide-y divide-slate-100">
                <Toggle checked={settings.notifications.eventReminders} onChange={(value) => updatePreference("notifications", "eventReminders", value)} label="Event reminders" description="Show in-app alerts for your scheduled calendar events." />
                <Toggle checked={settings.notifications.browserNotifications} onChange={enableBrowserNotifications} label="Browser notifications" description="Allow desktop/browser alerts while DevFlow OS is open. Browser permission is required." />
                <div className="py-5"><Field label="Remind me before an event" hint="Set to 0 minutes to alert at the event time."><select className={inputClass} value={settings.notifications.reminderMinutesBefore} onChange={(e) => updatePreference("notifications", "reminderMinutesBefore", Number(e.target.value))}><option value={0}>At event time</option><option value={5}>5 minutes before</option><option value={10}>10 minutes before</option><option value={15}>15 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option></select></Field></div>
                <p className="py-3 text-xs text-slate-500 dark-setting-muted">Reminder alerts require the app to be open. Browser notifications also depend on your browser permission.</p>
                <button onClick={savePreferences} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Save size={17} /> Save notification settings</button>
              </div>}

              {activeSection === "appearance" && <div className="space-y-5">
                <Field label="Theme" hint="Theme preference is saved in this browser."><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor }].map((option) => { const Icon = option.icon; const selected = settings.appearance.theme === option.value; return <button type="button" key={option.value} onClick={() => updateThemePreference(option.value)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-slate-700 dark:text-blue-300" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"}`}><Icon size={20} /><span className="font-semibold">{option.label}</span>{selected && <CheckCircle2 size={17} className="ml-auto" />}</button>; })}
                </div></Field>
                <p className="text-sm text-slate-500 dark-setting-muted">Light is the default. Dark mode applies a dark surface to the app and Settings page.</p>
                <button onClick={savePreferences} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Save size={17} /> Save appearance</button>
              </div>}

              {activeSection === "security" && <form onSubmit={savePassword} className="space-y-5">
                <div className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800"><LockKeyhole size={19} className="mt-0.5 shrink-0" /><p>Choose a password with at least 6 characters. Your current password is required to make this change. Use the eye button to show or hide what you type.</p></div>
                {[{ key: "oldPassword", label: "Current password", autoComplete: "current-password" }, { key: "newPassword", label: "New password", autoComplete: "new-password" }, { key: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" }].map((item) => (
                  <Field key={item.key} label={item.label}>
                    <div className="relative">
                      {input(passwordData[item.key], (e) => setPasswordData({ ...passwordData, [item.key]: e.target.value }), showPasswords[item.key] ? "text" : "password", { autoComplete: item.autoComplete, minLength: item.key === "oldPassword" ? undefined : 6, required: true, className: `${inputClass} pr-12` })}
                      <button type="button" aria-label={showPasswords[item.key] ? `Hide ${item.label.toLowerCase()}` : `Show ${item.label.toLowerCase()}`} onClick={() => setShowPasswords((previous) => ({ ...previous, [item.key]: !previous[item.key] }))} className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 transition hover:text-blue-600">
                        {showPasswords[item.key] ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </Field>
                ))}
                <button disabled={passwordSaving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><ShieldCheck size={17} /> {passwordSaving ? "Updating…" : "Change password"}</button>
              </form>}

              {activeSection === "notes" && <div className="space-y-5">
                <Field label="Default notes view" hint="Choose the view you prefer when you open the workspace."><select className={inputClass} value={settings.notes.defaultView} onChange={(e) => updatePreference("notes", "defaultView", e.target.value)}><option value="notes">My Notes</option><option value="dashboard">Dashboard overview</option><option value="favorites">Favorites</option></select></Field>
                <Field label="Sort notes by"><select className={inputClass} value={settings.notes.sortBy} onChange={(e) => updatePreference("notes", "sortBy", e.target.value)}><option value="newest">Newest first (default order)</option><option value="title">Title (A–Z)</option></select></Field>
                <button onClick={savePreferences} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Save size={17} /> Save notes preferences</button>
              </div>}

              {activeSection === "ai" && <div className="space-y-5">
                <Field label="AI response style"><select className={inputClass} value={settings.ai.responseStyle} onChange={(e) => updatePreference("ai", "responseStyle", e.target.value)}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></Field>
                <Field label="AI summary length"><select className={inputClass} value={settings.ai.summaryLength} onChange={(e) => updatePreference("ai", "summaryLength", e.target.value)}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></Field>
                <Field label="AI quiz difficulty"><select className={inputClass} value={settings.ai.quizDifficulty} onChange={(e) => updatePreference("ai", "quizDifficulty", e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field>
                <p className="text-xs text-slate-500 dark-setting-muted">These preferences are saved locally. Your current AI tools may need additional integration to apply every preference to generated results.</p>
                <button onClick={savePreferences} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Save size={17} /> Save AI preferences</button>
              </div>}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;
