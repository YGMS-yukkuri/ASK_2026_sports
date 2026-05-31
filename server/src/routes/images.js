import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// GET image - this is handled by express.static middleware in main app
// But we can add additional logic here if needed

router.get('/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Prevent directory traversal
  const safePath = path.normalize(filename).replace(/^(\.\.[/\\])+/, '');
  const imagePath = path.join(__dirname, '../../data/images', safePath);

  // Verify the path is within the images directory
  const baseDir = path.join(__dirname, '../../data/images');
  if (!imagePath.startsWith(baseDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error('Error serving image:', err);
      res.status(404).json({ error: 'Image not found' });
    }
  });
});

export default router;
