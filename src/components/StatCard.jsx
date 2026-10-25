function StatCard({ title, value, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition duration-300">
      <h3 className="text-gray-500 text-sm font-medium">
        {title}
      </h3>

      <h2 className={`text-3xl font-bold mt-2 ${color}`}>
        {value}
      </h2>
    </div>
  );
}

export default StatCard;