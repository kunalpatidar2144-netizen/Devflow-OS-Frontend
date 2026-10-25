function Button({
  children,
  type = "button",
  onClick,
  className = "",
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full bg-teal-700 hover:bg-teal-800 text-white py-3 rounded-xl font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;