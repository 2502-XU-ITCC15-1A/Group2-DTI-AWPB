import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../services/supabaseService";

export default function ConfirmPassword() {
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const prepareRecoverySession = async () => {
      try {
        const code = searchParams.get("code");
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (code) {
          await authService.exchangeRecoveryCode(code);
        } else if (accessToken && refreshToken && type === "recovery") {
          await authService.setRecoverySession(accessToken, refreshToken);
        } else {
          throw new Error("Invalid reset link. Please request a new password reset.");
        }

        if (isMounted) {
          setIsRecoveryReady(true);
          setError("");
        }
      } catch (error) {
        console.error("Recovery session error:", error);
        if (isMounted) {
          setError(error.message || "Invalid reset link. Please request a new password reset.");
        }
      }
    };

    prepareRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (isRecoveryReady && (searchParams.has("code") || window.location.hash)) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [isRecoveryReady, searchParams]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isRecoveryReady) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    if (!formData.newPassword || !formData.confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await authService.updatePassword(formData.newPassword);
      await authService.signOut();

      setSuccessMessage("Password has been reset successfully! Redirecting to login...");
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Reset password error:', error);
      setError(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-r from-[#014b4c] via-[#0a5d60] to-[#4f9597] px-6 py-8">
      <div className="w-full max-w-[550px] rounded-[2rem] bg-white px-8 py-10 shadow-xl md:px-12 md:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold leading-tight text-[#062f35]">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-slate-500 md:text-[15px]">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              New Password
            </label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="Enter new password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
              disabled={isLoading || !isRecoveryReady}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm new password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
              disabled={isLoading || !isRecoveryReady}
            />
            <p className="mt-2 text-xs text-slate-500">
              Password must be at least 8 characters long.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !isRecoveryReady}
            className="w-full rounded-full bg-[#233f8f] px-4 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'RESETTING PASSWORD...' : 'RESET PASSWORD'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-[#2a6b71] transition hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
