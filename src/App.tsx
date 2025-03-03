import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomePage from './pages/HomePage/HomePage'

function App() {
	return (
		<BrowserRouter>
			<Layout>
				<Routes>
					{/* Главная */}
					<Route path='/' element={<HomePage />} />

					{/* Настройки - заглушка */}
					<Route path='/settings' element={<div>Здесь будут настройки</div>} />

					{/* 404 */}
					<Route path='*' element={<div>Страница не найдена</div>} />
				</Routes>
			</Layout>
		</BrowserRouter>
	)
}

export default App
