// Backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Import your routes
import authRoutes from './routes/authRoutes.js';
import contractorRoutes from './routes/contractorRoutes.js';
import govRoutes from './routes/govRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import potholeRoutes from './routes/potholeRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Use your routes
app.use('/api/auth', authRoutes);
app.use('/api/contractor', contractorRoutes);
app.use('/api/gov', govRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/potholes', potholeRoutes); 

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});