
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Input from "../components/Input";
import Button from "../components/Button";
import { loginUser } from "../services/authService";
import { toast } from "sonner";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Clear only temporary AI chat drafts.
  // Saved conversations in the database are not deleted.
  const clearActiveChatDrafts = () => {
    // A successful login always begins a fresh AI Brain chat; saved chats remain in MongoDB.
    sessionStorage.removeItem("devflow-ai-brain-active-chat-v1");
    const prefix = "devflow-ai-assistant-draft-v1:";

    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);

      if (key?.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();

    const email = formData.email.trim();
    const password = formData.password;

    // Validate required fields
    if (!email || !password.trim()) {
      toast.warning("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      // Keep the existing login API
      const response = await loginUser({
        email,
        password,
      });

      const token = response?.data?.token;
      const user = response?.data?.user;

      // Do not continue if authentication failed
      if (!token) {
        toast.error("Login failed", {
          description: "Authentication token was not received.",
        });
        return;
      }

      // Preserve the existing Remember Me behaviour
      if (rememberMe) {
        localStorage.setItem("token", token);

        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
        }

        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
      } else {
        sessionStorage.setItem("token", token);

        if (user) {
          sessionStorage.setItem("user", JSON.stringify(user));
        }

        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }

      // Start a fresh temporary AI chat after successful login.
      // This does not delete saved conversations from the database.
      clearActiveChatDrafts();

      // Notify other components that a fresh login occurred.
      window.dispatchEvent(
        new CustomEvent("devflow:new-login", {
          detail: {
            userId: user?._id || user?.id || null,
          },
        })
      );

      toast.success("Login Successful", {
        description: "Welcome back to DevFlow OS 🚀",
      });

      // Navigate only after successful authentication
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error("Login Failed", {
        description:
          error.response?.data?.message ||
          "Invalid Email or Password",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">
          Welcome Back
        </h1>

        <p className="text-center text-gray-500 mb-8">
          Login to your NotePilot account
        </p>

        <form
          onSubmit={handleLogin}
          autoComplete="on"
          className="space-y-5"
        >
          {/* Email */}
          <Input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="username"
            required
          />

          {/* Password */}
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-4 text-gray-500"
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4"
              />

              Remember Me
            </label>
          </div>

          {/* Login Button */}
          <Button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        {/* Signup Link */}
        <p className="text-center mt-6 text-gray-600">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-teal-700 font-semibold"
          >
            Signup
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
