import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Costs } from './pages/dashboard/';

const App = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#f9fafb]">
        <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-[#2563EB] font-semibold">Dashboard</Link>
          <Link to="/costs" className="text-gray-700 hover:text-[#2563EB]">Costs</Link>
        </nav>
        <main className="p-4">
          <Routes>
            <Route path="/" element={<div className="text-gray-700">Welcome</div>} />
            <Route path="/costs" element={<Costs />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
