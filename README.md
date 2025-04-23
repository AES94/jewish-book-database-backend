# Jewish Book Database – Backend API

This is the backend for the Jewish Book Database project.

## Features
- RESTful API for book listings and submissions
- Admin approval flow
- Automated web crawler for new Jewish books
- MongoDB + Express + Node.js backend

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add a `.env` file
```env
MONGO_URI=your-mongodb-connection-string
```

### 3. Start the server
```bash
node server.js
```

## Deployment
Use Render.com or another platform that supports Node.js. Set:
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Environment Variable**: `MONGO_URI`

The crawler runs daily at 3 AM.
