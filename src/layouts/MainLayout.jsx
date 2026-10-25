import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function MainLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex flex-col flex-1">
        <Navbar />

        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;