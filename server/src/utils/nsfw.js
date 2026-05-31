import Filter from 'bad-words';

const filter = new Filter();

// Add custom words to filter
filter.addWords('hate', 'kill', 'die', 'stupid', 'dumb', 'damn');

function containsBadWords(text) {
  // Check if text contains profanity
  if (filter.isProfane(text)) {
    return { found: true };
  }
  return { found: false };
}

export async function checkNSFW(content, file) {
  // Check text for bad words
  const badWordCheck = containsBadWords(content);
  if (badWordCheck.found) {
    return {
      isNSFW: true,
      reason: 'Post contains inappropriate content'
    };
  }

  // Note: Image NSFW detection would require more complex setup
  // For production, consider using cloud-based APIs like Google Cloud Vision
  // For now, we rely on text filtering
  if (file) {
    console.log('Image file uploaded:', file.filename);
  }

  return {
    isNSFW: false,
    reason: null
  };
}
