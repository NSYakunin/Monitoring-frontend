// src/components/Layout/Layout.tsx

import React from 'react'
import { Container, Navbar, Nav } from 'react-bootstrap'
import { Link, useLocation } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
	children: React.ReactNode // всё, что вложено между <Layout> ... </Layout>
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
	// Определим, находимся ли мы на странице /settings (пример логики)
	const location = useLocation()
	const isSettingsPage = location.pathname.includes('/settings')

	return (
		<div className='d-flex flex-column min-vh-100'>
			{/* Шапка сайта */}
			<Navbar bg='dark' variant='dark' expand='sm' className='shadow'>
				<Container fluid>
					{/* Логотип/название */}
					<Navbar.Brand as={Link} to='/'>
						<img
							src='/logo192.png'
							alt='Мониторинг'
							style={{ height: '40px', marginRight: '8px' }}
						/>
						Мониторинг
					</Navbar.Brand>
					{/* Блок справа */}
					<Nav className='ms-auto'>
						{isSettingsPage ? (
							<Nav.Link as={Link} to='/'>
								На главную
							</Nav.Link>
						) : (
							<Nav.Link as={Link} to='/settings'>
								Настройки
							</Nav.Link>
						)}
					</Nav>
				</Container>
			</Navbar>

			{/* Основная часть страницы */}
			<main className='container-fluid flex-grow-1 content py-4'>
				{children}
			</main>

			{/* Подвал (footer) */}
			<footer className='main-footer mt-auto py-3'>
				<div className='container text-center'>
					<span className='footer-text'>
						Copyright © АО "НИИПМ" ВОРОНЕЖ, 2025.
						<br />
						Все права защищены.
					</span>
				</div>
			</footer>
		</div>
	)
}

export default Layout
