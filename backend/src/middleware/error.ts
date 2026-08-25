import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
export function errorHandler(err:any, _req:Request, res:Response, _next:NextFunction){
  logger.error({ err:err.message, stack:err.stack }, 'Unhandled error');
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const details = err.details || undefined;
  res.status(status).json({ success:false, error:message, details });
}
