import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomePage from './pages/HomePage/HomePage'
import LoginPage from './pages/LoginPage/LoginPage' // <-- Наш логин

function App() {
	return (
		<BrowserRouter>
			<Layout>
			<Routes>
				<Route path='/login' element={<LoginPage />} />
				<Route path='/' element={<HomePage />} />
					<Route path='/settings' element={<div>Настройки</div>} />
				<Route path='*' element={<div>Страница не найдена</div>} />
			</Routes>
			</Layout>
		</BrowserRouter>
	)
}

export default App
