# NEXORA – Full-Stack E-Commerce Platform

A modern, full-stack e-commerce platform built to provide a seamless online shopping experience with powerful customer features and comprehensive administrative management.

**Live Demo:** https://nexora-seven-ivory.vercel.app/

**GitHub Repository:** https://github.com/jaber10000/Nexora

---

## Overview

NEXORA is a full-stack e-commerce application designed with a modern frontend and a scalable backend architecture. It provides customers with an intuitive shopping experience while offering administrators tools to manage products, orders, inventory, coupons, and customer loyalty programs.

## Features

### Customer Features
- JWT-based user authentication
- Product browsing and management
- Shopping cart and wishlist
- Order placement and management
- Recently viewed products
- Coupon and discount management
- Customer loyalty points
- Responsive user interface

### Admin Features
- Admin dashboard
- Product and inventory management
- Order management
- Coupon management
- Customer management

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | FastAPI, Python |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Authentication | JWT |
| Styling | Tailwind CSS |
| Deployment | Vercel, Render |

## Project Architecture

- **Frontend:** Responsive user interface developed with Next.js, React, and TypeScript.
- **Backend:** RESTful APIs developed using FastAPI and Python.
- **Database:** PostgreSQL with SQLAlchemy for data management.
- **Authentication:** JWT-based authentication and protected routes.
- **Deployment:** Frontend hosted on Vercel and backend on Render.

## Getting Started

### Prerequisites
- Node.js and npm
- Python 3.10+
- PostgreSQL

### 1. Clone the Repository

```bash
git clone https://github.com/jaber10000/Nexora.git
cd Nexora
```

### 2. Backend Setup

```bash
cd backend

py -m venv venv

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

Configure your backend environment variables in `.env` according to the project's configuration.

Start the backend:

```bash
uvicorn app.main:app --reload
```

Backend API: http://127.0.0.1:8000

API Documentation: http://127.0.0.1:8000/docs

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create `.env.local` and configure:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Run the development server:

```bash
npm run dev
```

Frontend: http://localhost:3000

## Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | PostgreSQL (Neon) |

## Future Improvements

- Online payment gateway integration
- Advanced product analytics
- Enhanced product recommendation system
- Improved security and performance optimization

## Author

**Md. Abdullah Al Jaber**

Computer Science & Engineering Graduate | AI/ML & Full-Stack Developer

- GitHub: https://github.com/jaber10000
- Portfolio: https://jaber-portfolio.web.app/

---

⭐ If you find this project useful, consider giving it a star!
