import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to verify GitHub webhook signatures
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export const verifyWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const event = req.headers['x-github-event'] as string;
  const id = req.headers['x-github-delivery'] as string;
  
  // Check if all required headers are present
  if (!signature || !event || !id) {
    console.error('Missing required GitHub webhook headers');
    return res.status(400).send('Missing required GitHub webhook headers');
  }

  // Skip verification if no webhook secret is set (not recommended for production)
  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    console.warn('No webhook secret set, skipping signature verification');
    return next();
  }

  try {
    // Get the raw request body
    const rawBody = (req as any).rawBody;
    
    if (!rawBody) {
      console.error('Raw body not available for signature verification');
      return res.status(500).send('Raw body not available for signature verification');
    }
    
    // Create the expected signature
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const calculatedSignature = 'sha256=' + hmac.update(rawBody).digest('hex');
    
    // Compare signatures using a constant-time comparison function
    if (!crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    )) {
      console.error('Invalid webhook signature');
      return res.status(401).send('Invalid signature');
    }
    
    // Signature is valid, proceed
    next();
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return res.status(500).send('Error verifying webhook signature');
  }
}; 