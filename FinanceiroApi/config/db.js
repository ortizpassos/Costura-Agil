import mongoose from 'mongoose';

export async function connectDB(uri){
  const mongoUri = uri || process.env.MONGODB_URI;
  if(!mongoUri) throw new Error('MONGODB_URI não definido');
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, {
    autoIndex: true
  });
  console.log('📦 MongoDB conectado');
}
