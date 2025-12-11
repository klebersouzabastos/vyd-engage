// Vercel Serverless Function - API Routes Handler
// This file handles all /api/* routes

import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/src/index.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Convert Vercel request/response to Express-compatible format
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err?: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}




