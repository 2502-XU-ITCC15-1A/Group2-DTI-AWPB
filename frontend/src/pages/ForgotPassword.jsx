import { useState } from "react";
import { Link } from "react-router-dom";
import { buildAppUrl } from "../lib/siteUrl";
import { supabase } from "../lib/supabase";
import { authService } from "../services/supabaseService";

export default function ForgotPassword() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedUsername = formData.username.trim().toLowerCase();
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail) {
      setSuccessMessage("");
      setError("Please enter your username and registered email.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const { data: lookedUpEmail, error: rpcError } = await supabase
        .rpc("get_email_by_username", { p_username: normalizedUsername });

      if (rpcError) {
        console.error("Username lookup failed:", rpcError);
        throw rpcError;
      }

      if (!lookedUpEmail || lookedUpEmail.toLowerCase() !== normalizedEmail) {
        setSuccessMessage("If the account exists, a password reset link has been sent to the email address.");
        return;
      }

      const authEmail = await authService.getLoginEmailByUsername(normalizedUsername);

      if (!authEmail) throw new Error("Account login email was not found.");

      await authService.requestPasswordReset(
        authEmail,
        buildAppUrl("/confirm-password")
      );

      setSuccessMessage("If the account exists, a password reset link has been sent to the email address.");
    } catch (error) {
      console.error('Forgot password error:', error);
      setError(error.message || 'Failed to request password reset. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-r from-[#014b4c] via-[#0a5d60] to-[#4f9597] px-6 py-8">
      <div className="w-full max-w-[550px] rounded-[2rem] bg-white px-8 py-10 shadow-xl md:px-12 md:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold leading-tight text-[#062f35]">
            Forgot Password
          </h1>
          <p className="mt-2 text-sm text-slate-500 md:text-[15px]">
            Enter the username and email for the account to reset.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Username"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Registered Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="encoder@dti.gov.ph"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
            />
            
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
            disabled={isLoading}
            className="w-full rounded-full bg-[#233f8f] px-4 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'SENDING RESET LINK...' : 'REQUEST RESET'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-sm font-medium text-[#2a6b71] transition hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
