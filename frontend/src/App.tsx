import './style.css'
import NavBar from "./NavBar.tsx";
import { Routes, Route } from 'react-router-dom'
import Home from "./pages/Home.tsx";
import Review from "./pages/Review.tsx";
import Add from "./pages/Add.tsx";
import Browse from "./pages/Browse.tsx";


function App() {

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
            <NavBar />
            <Routes >
                <Route path="/" element={<Home />} />
                <Route path="/review" element={<Review />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/add" element={<Add />} />
            </Routes>
        </div>
    )
}

export default App
