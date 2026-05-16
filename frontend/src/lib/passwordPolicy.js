export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";

export function getPasswordPolicyError(password, { required = false } = {}) {
  const value = String(password || "");

  if (!value) {
    return required ? "Password is required." : "";
  }

  if (value.length < 8) return PASSWORD_POLICY_MESSAGE;
  if (!/[A-Z]/.test(value)) return PASSWORD_POLICY_MESSAGE;
  if (!/[a-z]/.test(value)) return PASSWORD_POLICY_MESSAGE;
  if (!/[0-9]/.test(value)) return PASSWORD_POLICY_MESSAGE;
  if (!/[^A-Za-z0-9\s]/.test(value)) return PASSWORD_POLICY_MESSAGE;

  return "";
}
