function Input({
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  autoComplete,
}) {
  return (
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
    />
  );
}

export default Input;